import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubscriptionCache extends Document<string> {
  _id: string; // fixed key: "subscription_cache"
  domain: string;
  subscribed: boolean;
  expired: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  checkedAt: string;
  cachedAt: Date;
}

const SubscriptionCacheSchema = new Schema<ISubscriptionCache>({
  _id: { type: String, required: true },
  domain: { type: String, required: true },
  subscribed: { type: Boolean, required: true },
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
