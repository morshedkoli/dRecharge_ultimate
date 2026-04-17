import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import AgentRegistrationToken from "@/lib/db/models/AgentRegistrationToken";
import { signAgentToken } from "@/lib/auth/jwt";
import { writeLog } from "@/lib/db/audit";
import { notifyDeviceRegistered } from "@/lib/notifications";
import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildAgentEmail(deviceId: string) {
  return `agent.${deviceId}@drecharge.local`;
}

// POST /api/agent/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    const name = String(body?.name || "").trim();
    const simProvider = String(body?.simProvider || "SIM 1").trim();
    const deviceFingerprint = String(body?.deviceFingerprint || "").trim();
    const appVersion = String(body?.appVersion || "").trim();

    if (!token || !name) {
      return NextResponse.json({ error: "token and name are required" }, { status: 400 });
    }

    await connectDB();

    const tokenHash = hashToken(token);
    const regToken = await AgentRegistrationToken.findById(tokenHash);

    if (!regToken) {
      return NextResponse.json({ error: "Registration token not found" }, { status: 404 });
    }
    if (regToken.usedAt) {
      return NextResponse.json({ error: "Registration token already used" }, { status: 409 });
    }
    if (regToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Registration token expired" }, { status: 410 });
    }

    const deviceId = nanoid(20);
    const authUid = `agent_${deviceId}`;
    const authEmail = buildAgentEmail(deviceId);
    const jwtSecret = randomBytes(32).toString("hex");

    await AgentDevice.create({
      _id: deviceId,
      name,
      simProvider: simProvider || "Unknown",
      authUid,
      authEmail,
      jwtSecret,
      status: "online",
      appVersion: appVersion || "",
      deviceFingerprint: deviceFingerprint || "",
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    });

    regToken.usedAt = new Date();
    regToken.usedByDeviceId = deviceId;
    regToken.authUid = authUid;
    regToken.authEmail = authEmail;
    await regToken.save();

    // Sign an agent JWT
    const jwtToken = await signAgentToken(
      { sub: authUid, deviceId, role: "agent" },
      jwtSecret
    );

    await writeLog({
      action: "DEVICE_REGISTERED",
      entityId: deviceId,
      meta: { deviceId, authUid, authEmail, simProvider, appVersion },
    });
    await notifyDeviceRegistered(name);

    return NextResponse.json({ success: true, deviceId, jwtToken, authUid });
  } catch (err) {
    console.error("Device registration error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
