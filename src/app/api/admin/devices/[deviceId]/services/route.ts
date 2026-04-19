import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { withAdminSession } from "@/lib/auth/session";

// PATCH /api/admin/devices/[deviceId]/services
// Body: { serviceIds: string[] }
// Assigns services to a device. Each service can only belong to one device at a time —
// any serviceId being assigned here is removed from all other devices first.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  return withAdminSession(request, async () => {
    const { deviceId } = await params;
    const body = await request.json();
    const serviceIds: string[] = Array.isArray(body?.serviceIds)
      ? body.serviceIds.filter((id: unknown) => typeof id === "string")
      : [];

    await connectDB();

    const device = await AgentDevice.findById(deviceId);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    if (device.status === "revoked") {
      return NextResponse.json({ error: "Device is revoked" }, { status: 400 });
    }

    // Remove these serviceIds from every other device to enforce one-service-one-device
    if (serviceIds.length > 0) {
      await AgentDevice.updateMany(
        { _id: { $ne: deviceId } },
        { $pull: { assignedServices: { $in: serviceIds } } }
      );
    }

    await AgentDevice.findByIdAndUpdate(deviceId, {
      assignedServices: serviceIds,
    });

    return NextResponse.json({ success: true, assignedServices: serviceIds });
  });
}
