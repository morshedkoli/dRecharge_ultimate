import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentRegistrationToken from "@/lib/db/models/AgentRegistrationToken";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";

const REGISTRATION_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function buildRegistrationToken() {
  return `DRA-${randomBytes(18).toString("hex").toUpperCase()}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// POST /api/admin/devices/token — generate registration token
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    await connectDB();

    const token = buildRegistrationToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS);

    await AgentRegistrationToken.create({
      _id: tokenHash,
      tokenHash,
      createdBy: session.sub,
      expiresAt,
      createdAt: new Date(),
    });

    await writeLog({ uid: session.sub, action: "DEVICE_TOKEN_GENERATED", severity: "warn", meta: { expiresAt: expiresAt.toISOString() } });
    return NextResponse.json({ success: true, token, expiresAt: expiresAt.getTime() });
  });
}

// GET /api/admin/devices/token — list devices
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const devices = await AgentDevice.find({ status: { $ne: "revoked" } })
      .sort({ registeredAt: -1 })
      .lean();
    const mapped = devices.map(d => ({
      deviceId: d._id,
      name: d.name,
      status: d.status,          // include DB status so client can preserve "revoked"
      simProvider: d.simProvider,
      authUid: d.authUid,
      authEmail: d.authEmail,
      lastHeartbeat: d.lastHeartbeat,
      currentJob: d.currentJob,
      isPoweredOn: d.isPoweredOn !== false, // default true for old devices
      appVersion: d.appVersion,
      assignedServices: d.assignedServices ?? [],
      registeredAt: d.registeredAt,
    }));
    return NextResponse.json({ devices: mapped });
  });
}
