import mongoose, { Schema, Document, Model } from "mongoose";

export type TxType = "send" | "topup" | "deduct" | "refund";
export type TxStatus = "pending" | "processing" | "complete" | "failed";

export interface ITransaction extends Document<string> {
  _id: string;
  userId: string;
  type: TxType;
  serviceId?: string;
  recipientNumber?: string;
  amount: number;
  fee: number;
  status: TxStatus;
  note?: string;
  adminId?: string;
  createdAt: Date;
  completedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["send", "topup", "deduct", "refund"], required: true },
    serviceId: { type: String },
    recipientNumber: { type: String },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "processing", "complete", "failed"],
      default: "pending",
    },
    note: { type: String },
    adminId: { type: String },
    completedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    _id: false,
  }
);

TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
