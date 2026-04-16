import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { verifyAgentToken } from "@/lib/auth/jwt";

// Helper: extract + verify agent JWT from Authorization header
export async function extractAgentSession(request: NextRequest) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  // We need to find the device to get its jwtSecret
  // Decode the token header to get deviceId claim (without verifying first)
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const deviceId = payload.deviceId;
    if (!deviceId) return null;

    await connectDB();
    const device = await AgentDevice.findById(deviceId).lean();
    if (!device || device.status === "revoked") return null;

    const verified = await verifyAgentToken(token, device.jwtSecret);
    if (!verified) return null;

    return { deviceId, authUid: verified.sub, device };
  } catch {
    return null;
  }
}
