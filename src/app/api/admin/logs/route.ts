import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AuditLog from "@/lib/db/models/AuditLog";
import { withAdminSession } from "@/lib/auth/session";

// GET /api/admin/logs
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const severity = searchParams.get("severity");
    const filter: Record<string, unknown> = {};
    if (severity) filter.severity = severity;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const mapped = logs.map(l => ({
      id: l._id,
      uid: l.uid,
      action: l.action,
      entityId: l.entityId,
      ip: l.ip,
      location: l.location,
      userAgent: l.userAgent,
      deviceType: l.deviceType,
      browser: l.browser,
      os: l.os,
      severity: l.severity,
      meta: l.meta,
      timestamp: l.timestamp,
    }));

    return NextResponse.json({ logs: mapped });
  });
}
