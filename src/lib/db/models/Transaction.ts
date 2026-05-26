import mongoose, { Schema, Document, Model } from "mongoose";

export type TxType = "send" | "topup" | "deduct" | "refund" | "credit";
export type TxStatus = "pending" | "processing" | "waiting" | "complete" | "failed";

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
  failureReason?: string;   // user-facing failure reason from matched SMS template
  // Captured from the provider's success SMS / USSD response on completion
  providerTxId?: string;       // operator-side transaction reference (e.g. bKash TrxID)
  providerBalance?: string;    // remaining agent balance reported by provider
  providerAmount?: string;     // amount as reported in provider SMS
  providerRecipient?: string;  // recipient (often masked) as reported in provider SMS
  adminId?: string;
  idempotencyKey?: string;     // client-supplied dedup key for POST /transactions
  createdAt: Date;
  completedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["send", "topup", "deduct", "refund", "credit"], required: true },
    serviceId: { type: String },
    recipientNumber: { type: String },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "processing", "waiting", "complete", "failed"],
      default: "pending",
    },
    note: { type: String },
    failureReason: { type: String },
    providerTxId: { type: String },
    providerBalance: { type: String },
    providerAmount: { type: String },
    providerRecipient: { type: String },
    adminId: { type: String },
    idempotencyKey: { type: String },
    completedAt: { type: Date },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
