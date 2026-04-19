import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import DeviceInfo from "@/lib/db/models/DeviceInfo";
import { extractAgentSession } from "../_auth";

// POST /api/agent/device-info — receive and upsert device hardware/network info
export async function POST(request: NextRequest) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    await connectDB();

    await DeviceInfo.findByIdAndUpdate(
      agentSession.deviceId,
      {
        _id: agentSession.deviceId,
        deviceName: String(body?.deviceName || "").trim(),
        model: String(body?.model || "").trim(),
        brand: String(body?.brand || "").trim(),
        manufacturer: String(body?.manufacturer || "").trim(),
        androidVersion: String(body?.androidVersion || "").trim(),
        sdkInt: Number(body?.sdkInt) || 0,
        ramTotalMb: Number(body?.ramTotalMb) || 0,
        ramAvailableMb: Number(body?.ramAvailableMb) || 0,
        storageTotalMb: Number(body?.storageTotalMb) || 0,
        storageAvailableMb: Number(body?.storageAvailableMb) || 0,
        batteryLevel: Number(body?.batteryLevel) || 0,
        isCharging: body?.isCharging === true,
        networkType: String(body?.networkType || "unknown").trim(),
        ipAddress: String(body?.ipAddress || "").trim(),
        simCarrier: String(body?.simCarrier || "").trim(),
        syncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Device info error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
