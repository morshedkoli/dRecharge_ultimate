import mongoose, { Schema, Document, Model } from "mongoose";

export type DeviceStatus = "online" | "offline" | "busy" | "revoked" | "paused";

export interface IAgentDevice extends Document<string> {
  _id: string; // deviceId
  name: string;
  status: DeviceStatus;
  simProvider: string;
  authUid: string;
  authEmail: string;
  jwtSecret: string; // per-device secret for signing agent JWTs
  lastHeartbeat: Date;
  currentJob?: string;
  isPoweredOn: boolean;
  appVersion?: string;
  deviceFingerprint?: string;
  assignedServices: string[]; // service IDs assigned to this device
  registeredAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

const AgentDeviceSchema = new Schema<IAgentDevice>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["online", "offline", "busy", "revoked", "paused"],
      default: "online",
    },
    isPoweredOn: { type: Boolean, default: true },
    simProvider: { type: String, default: "Unknown" },
    authUid: { type: String, required: true, unique: true },
    authEmail: { type: String, required: true },
    jwtSecret: { type: String, required: true },
    lastHeartbeat: { type: Date, default: Date.now },
    currentJob: { type: String },
    appVersion: { type: String, default: "" },
    deviceFingerprint: { type: String, default: "" },
    assignedServices: { type: [String], default: [] },
    registeredAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
    revokedBy: { type: String },
  },
  {}
);

AgentDeviceSchema.index({ status: 1 });

const AgentDevice: Model<IAgentDevice> =
  mongoose.models.AgentDevice ||
  mongoose.model<IAgentDevice>("AgentDevice", AgentDeviceSchema);

export default AgentDevice;
