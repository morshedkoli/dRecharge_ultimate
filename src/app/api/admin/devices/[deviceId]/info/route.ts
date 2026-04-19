import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import DeviceInfo from "@/lib/db/models/DeviceInfo";
import { withAdminSession } from "@/lib/auth/session";

// GET /api/admin/devices/[deviceId]/info — fetch stored device hardware info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  return withAdminSession(request, async () => {
    const { deviceId } = await params;
    await connectDB();

    const info = await DeviceInfo.findById(deviceId).lean();
    if (!info) {
      return NextResponse.json({ info: null });
    }

    return NextResponse.json({
      info: {
        deviceId: info._id,
        deviceName: info.deviceName,
        model: info.phoneModel,
        brand: info.brand,
        manufacturer: info.manufacturer,
        androidVersion: info.androidVersion,
        sdkInt: info.sdkInt,
        ramTotalMb: info.ramTotalMb,
        ramAvailableMb: info.ramAvailableMb,
        storageTotalMb: info.storageTotalMb,
        storageAvailableMb: info.storageAvailableMb,
        batteryLevel: info.batteryLevel,
        isCharging: info.isCharging,
        networkType: info.networkType,
        ipAddress: info.ipAddress,
        simCarrier: info.simCarrier,
        syncedAt: info.syncedAt,
      },
    });
  });
}
