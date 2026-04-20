import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubscriptionCache extends Document<string> {
  _id: string;
  domain: string;
  state: string; // "active" | "expired" | "inactive" | "untracked" | "unknown"
  subscribed: boolean;
  tracked: boolean;
  expired: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  checkedAt: string;
  cachedAt: Date;
}

const SubscriptionCacheSchema = new Schema<ISubscriptionCache>({
  _id: { type: String, required: true },
  domain: { type: String, required: true },
  state: { type: String, required: true, default: "unknown" },
  subscribed: { type: Boolean, required: true },
  tracked: { type: Boolean, required: true, default: false },
  expired: { type: Boolean, required: true },
  expiresAt: { type: String, default: null },
  daysUntilExpiry: { type: Number, default: null },
  checkedAt: { type: String, required: true },
  cachedAt: { type: Date, required: true },
});

const SubscriptionCache: Model<ISubscriptionCache> =
  mongoose.models.SubscriptionCache ||
  mongoose.model<ISubscriptionCache>("SubscriptionCache", SubscriptionCacheSchema);

export default SubscriptionCache;
