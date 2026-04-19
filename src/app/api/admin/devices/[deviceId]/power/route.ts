import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { withAdminSession } from "@/lib/auth/session";

// POST /api/admin/devices/[deviceId]/power
// Body: { isPoweredOn: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  return withAdminSession(request, async () => {
    const { deviceId } = await params;
    const body = await request.json();
    const isPoweredOn = body?.isPoweredOn === true;

    await connectDB();

    const device = await AgentDevice.findById(deviceId);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    if (device.status === "revoked") {
      return NextResponse.json({ error: "Device is revoked" }, { status: 400 });
    }

    await AgentDevice.findByIdAndUpdate(deviceId, {
      isPoweredOn,
      // If the admin is turning off, mark as paused immediately.
      // The device's next heartbeat will confirm; until then show paused.
      status: isPoweredOn ? "online" : "paused",
    });

    return NextResponse.json({ success: true, isPoweredOn });
  });
}
