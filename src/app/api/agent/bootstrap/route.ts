import { NextRequest, NextResponse } from "next/server";
import { resolvePublicBaseUrl } from "@/lib/server/public-base-url";

export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request);

  return NextResponse.json({
    success: true,
    app: "dRecharge Agent Backend",
    baseUrl,
    registrationPath: "/api/agent/register",
    heartbeatPath: "/api/agent/heartbeat",
    queuePath: "/api/agent/queue",
  });
}
