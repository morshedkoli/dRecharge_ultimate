import mongoose, { Schema, Document, Model } from "mongoose";

export type WalletEntryKind =
  | "debit"            // tx initiated, balance reduced
  | "refund"           // failed tx, balance restored
  | "topup_approved"   // balance request approved by admin
  | "admin_credit"     // direct admin credit (positive adjust)
  | "admin_debit"      // direct admin debit (negative adjust)
  | "opening_balance"  // one-time backfill of pre-ledger balance
  | "transfer_in"      // sub-user transfer received
  | "transfer_out";    // sub-user transfer sent

export interface IWalletEntry extends Document<string> {
  _id: string;
  userId: string;
  kind: WalletEntryKind;
  amount: number;        // positive: credit to user; negative: debit
  balanceAfter: number;  // user's walletBalance after this entry was applied
  txId?: string;         // linked Transaction (for debit/refund)
  jobId?: string;        // linked ExecutionJob (for debit/refund)
  balanceRequestId?: string;
  actorUid?: string;     // who triggered (admin uid, or user uid)
  note?: string;
  createdAt: Date;
}

const WalletEntrySchema = new Schema<IWalletEntry>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: [
        "debit",
        "refund",
        "topup_approved",
        "admin_credit",
        "admin_debit",
        "opening_balance",
        "transfer_in",
        "transfer_out",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    txId: { type: String, index: true, sparse: true },
    jobId: { type: String, sparse: true },
    balanceRequestId: { type: String, sparse: true },
    actorUid: { type: String },
    note: { type: String },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

WalletEntrySchema.index({ userId: 1, createdAt: -1 });
WalletEntrySchema.index({ kind: 1, createdAt: -1 });

const WalletEntry: Model<IWalletEntry> =
  mongoose.models.WalletEntry ||
  mongoose.model<IWalletEntry>("WalletEntry", WalletEntrySchema);

export default WalletEntry;
