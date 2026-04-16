import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";

type Params = { params: Promise<{ deviceId: string }> };

// POST /api/admin/devices/[deviceId]/revoke
export async function POST(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { deviceId } = await params;
    await connectDB();

    const device = await AgentDevice.findById(deviceId);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    device.status = "revoked";
    device.revokedAt = new Date();
    device.revokedBy = session.sub;
    device.currentJob = undefined;
    await device.save();

    await writeLog({
      uid: session.sub,
      action: "DEVICE_REVOKED",
      entityId: deviceId,
      severity: "warn",
      meta: { deviceId, authUid: device.authUid },
    });

    return NextResponse.json({ success: true });
  });
}
