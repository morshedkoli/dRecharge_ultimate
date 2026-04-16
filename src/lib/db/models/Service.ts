import mongoose, { Schema, Document, Model } from "mongoose";

export interface IService extends Document<string> {
  _id: string;
  name: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  categoryId?: string;
  ussdFlow: string;
  pin: string;
  simSlot: number;
  successSmsFormat: string;
  failureSmsFormat: string;
  smsTimeout: number;
  updatedAt: Date;
  updatedBy: string;
}

const ServiceSchema = new Schema<IService>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, default: "" },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    categoryId: { type: String, default: null },
    ussdFlow: { type: String, default: "" },
    pin: { type: String, default: "" },
    simSlot: { type: Number, default: 1 },
    successSmsFormat: { type: String, default: "" },
    failureSmsFormat: { type: String, default: "" },
    smsTimeout: { type: Number, default: 30 },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updatedAt" },
    _id: false,
  }
);

ServiceSchema.index({ isActive: 1 });
ServiceSchema.index({ categoryId: 1 });

const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);

export default Service;
