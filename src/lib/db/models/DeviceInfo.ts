import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDeviceInfo extends Document<string> {
  _id: string; // deviceId
  deviceName: string;
  model: string;
  brand: string;
  manufacturer: string;
  androidVersion: string;
  sdkInt: number;
  ramTotalMb: number;
  ramAvailableMb: number;
  storageTotalMb: number;
  storageAvailableMb: number;
  batteryLevel: number; // 0–100
  isCharging: boolean;
  networkType: string; // "wifi" | "mobile" | "none" | "other"
  ipAddress: string;
  simCarrier: string;
  syncedAt: Date;
}

const DeviceInfoSchema = new Schema<IDeviceInfo>(
  {
    _id: { type: String, required: true },
    deviceName: { type: String, default: "" },
    model: { type: String, default: "" },
    brand: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    androidVersion: { type: String, default: "" },
    sdkInt: { type: Number, default: 0 },
    ramTotalMb: { type: Number, default: 0 },
    ramAvailableMb: { type: Number, default: 0 },
    storageTotalMb: { type: Number, default: 0 },
    storageAvailableMb: { type: Number, default: 0 },
    batteryLevel: { type: Number, default: 0 },
    isCharging: { type: Boolean, default: false },
    networkType: { type: String, default: "unknown" },
    ipAddress: { type: String, default: "" },
    simCarrier: { type: String, default: "" },
    syncedAt: { type: Date, default: Date.now },
  },
  {}
);

const DeviceInfo: Model<IDeviceInfo> =
  mongoose.models.DeviceInfo ||
  mongoose.model<IDeviceInfo>("DeviceInfo", DeviceInfoSchema);

export default DeviceInfo;
