import { NextRequest, NextResponse } from "next/server";
import { withAdminSession } from "@/lib/auth/session";
import { resolveAdminDisplayUrl } from "@/lib/server/public-base-url";

export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    // Use the real server URL for display — what admins see and share with agents.
    const baseUrl = resolveAdminDisplayUrl(request);

    return NextResponse.json({
      baseUrl,
      bootstrapUrl: `${baseUrl}/api/agent/bootstrap`,
      registerUrl: `${baseUrl}/api/agent/register`,
      heartbeatUrl: `${baseUrl}/api/agent/heartbeat`,
      queueUrl: `${baseUrl}/api/agent/queue`,
    });
  });
}
