import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISiteSettings extends Document<string> {
  _id: "site_settings"; // singleton doc
  domain: string;
  phoneNumber: string;
  setupComplete: boolean;
  noticeText?: string;
  isNoticeEnabled?: boolean;
  bannerUrls?: string[];
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    _id: { type: String, default: "site_settings" },
    domain: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    setupComplete: { type: Boolean, default: true },
    noticeText: { type: String, default: "" },
    isNoticeEnabled: { type: Boolean, default: true },
    bannerUrls: { type: [String], default: [] },
    appName: { type: String, default: "PayChat" },
    logoUrl: { type: String, default: "/logo.png" },
    primaryColor: { type: String, default: "#134235" },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updatedAt" },
  }
);

// In development, clear the cached model to allow schema updates to hot-reload
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.SiteSettings;
}

const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", SiteSettingsSchema);

export default SiteSettings;
