import { NextRequest, NextResponse } from "next/server";
import { resolvePublicBaseUrl } from "@/lib/server/public-base-url";
import connectDB from "@/lib/db/mongoose";
import SiteSettings from "@/lib/db/models/SiteSettings";

export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request);
  
  await connectDB();
  const settings = await SiteSettings.findById("site_settings").lean();

  return NextResponse.json({
    success: true,
    app: `${settings?.appName || "dRecharge"} Agent Backend`,
    baseUrl,
    registrationPath: "/api/agent/register",
    heartbeatPath: "/api/agent/heartbeat",
    queuePath: "/api/agent/queue",
  });
}
