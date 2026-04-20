import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISiteSettings extends Document<string> {
  _id: "site_settings"; // singleton doc
  domain: string;
  phoneNumber: string;
  setupComplete: boolean;
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    _id: { type: String, default: "site_settings" },
    domain: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    setupComplete: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updatedAt" },
  }
);

const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", SiteSettingsSchema);

export default SiteSettings;
