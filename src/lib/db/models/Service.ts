import mongoose, { Schema, Document, Model } from "mongoose";

export interface IService extends Document<string> {
  _id: string;
  name: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  categoryId?: string;
  ussdSteps: {
    order: number;
    type: "dial" | "select" | "input" | "wait";
    label: string;
    value: string;
    waitMs?: number;
  }[];
  pin: string;
  simSlot: number;
  successSmsFormat: string;
  failureSmsTemplates: {              // multi-failure templates (source of truth)
    template: string;                 // SMS pattern to match
    message: string;                  // user-facing failure reason
  }[];
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
    ussdSteps: {
      type: [
        {
          order:  { type: Number, required: true },
          type:   { type: String, enum: ["dial", "select", "input", "wait"], required: true },
          label:  { type: String, default: "" },
          value:  { type: String, default: "" },
          waitMs: { type: Number },
        },
      ],
      default: [],
    },
    pin: { type: String, default: "" },
    simSlot: { type: Number, default: 1 },
    successSmsFormat: { type: String, default: "" },
    failureSmsTemplates: {
      type: [
        {
          template: { type: String, default: "" },
          message:  { type: String, default: "" },
        },
      ],
      default: [],
    },
    smsTimeout: { type: Number, default: 30 },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updatedAt" },
  }
);

ServiceSchema.index({ isActive: 1 });
ServiceSchema.index({ categoryId: 1 });

const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);

export default Service;
