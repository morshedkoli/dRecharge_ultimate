import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";

export interface INotification extends Document<string> {
  _id: string;
  /** User UID for user-specific alerts, or "admin" for all-admin broadcasts. */
  recipientUid: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  /** Optional relative URL to navigate to on click. */
  link?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    _id:          { type: String, default: () => nanoid(20) },
    recipientUid: { type: String, required: true, index: true },
    type:         { type: String, required: true },
    title:        { type: String, required: true },
    body:         { type: String, required: true },
    isRead:       { type: Boolean, default: false },
    link:         { type: String },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

NotificationSchema.index({ recipientUid: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
