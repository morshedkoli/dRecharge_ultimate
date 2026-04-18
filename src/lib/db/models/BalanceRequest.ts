import mongoose, { Schema, Document, Model } from "mongoose";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface IBalanceRequest extends Document<string> {
  _id: string;
  userId: string;
  amount: number;
  status: RequestStatus;
  medium?: string;
  note?: string;
  adminNote?: string;
  approvedBy?: string;
  createdAt: Date;
  processedAt?: Date;
}

const BalanceRequestSchema = new Schema<IBalanceRequest>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    medium: { type: String, default: "" },
    note: { type: String, default: "" },
    adminNote: { type: String },
    approvedBy: { type: String },
    processedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "requestedAt", updatedAt: "updatedAt" },
  }
);

BalanceRequestSchema.index({ status: 1, createdAt: -1 });

const BalanceRequest: Model<IBalanceRequest> =
  mongoose.models.BalanceRequest ||
  mongoose.model<IBalanceRequest>("BalanceRequest", BalanceRequestSchema);

export default BalanceRequest;
