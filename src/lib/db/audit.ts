import connectDB from "@/lib/db/mongoose";
import AuditLog from "@/lib/db/models/AuditLog";

export async function writeLog(data: {
  uid?: string;
  action: string;
  entityId?: string;
  severity?: "info" | "warn" | "error" | "critical";
  meta?: Record<string, unknown>;
  ip?: string;
  location?: object;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}) {
  try {
    await connectDB();
    await AuditLog.create({
      ...data,
      severity: data.severity || "info",
      meta: data.meta || {},
      ip: data.ip || "server",
      location: data.location || {},
      userAgent: data.userAgent || "server",
      deviceType: data.deviceType || "server",
      browser: data.browser || "server",
      os: data.os || "server",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("writeLog failed:", err);
  }
}
