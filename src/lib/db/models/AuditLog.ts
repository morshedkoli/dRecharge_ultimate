import mongoose, { Schema, Document, Model } from "mongoose";

export type LogSeverity = "info" | "warn" | "error" | "critical";

export interface IAuditLog extends Document<string> {
  uid?: string;
  action: string;
  entityId?: string;
  ip: string;
  location: object;
  userAgent: string;
  deviceType: string;
  browser: string;
  os: string;
  severity: LogSeverity;
  meta: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  uid: { type: String },
  action: { type: String, required: true },
  entityId: { type: String },
  ip: { type: String, default: "server" },
  location: { type: Schema.Types.Mixed, default: {} },
  userAgent: { type: String, default: "server" },
  deviceType: { type: String, default: "server" },
  browser: { type: String, default: "server" },
  os: { type: String, default: "server" },
  severity: {
    type: String,
    enum: ["info", "warn", "error", "critical"],
    default: "info",
  },
  meta: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ severity: 1 });
AuditLogSchema.index({ uid: 1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
