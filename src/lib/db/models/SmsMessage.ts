import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISmsMessage extends Document<string> {
  _id: string;          // nanoid
  deviceId: string;     // which agent device received the SMS
  deviceName?: string;  // denormalised device name at time of receipt
  sender: string;       // phone number / alphanumeric sender id
  body: string;         // full SMS body text
  receivedAt: Date;     // timestamp on the Android device
  createdAt: Date;      // when the server stored it
  isRead: boolean;
}

const SmsMessageSchema = new Schema<ISmsMessage>(
  {
    _id:        { type: String, required: true },
    deviceId:   { type: String, required: true, index: true },
    deviceName: { type: String, default: "" },
    sender:     { type: String, required: true },
    body:       { type: String, required: true },
    receivedAt: { type: Date, required: true },
    isRead:     { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

SmsMessageSchema.index({ createdAt: -1 });
SmsMessageSchema.index({ deviceId: 1, createdAt: -1 });
SmsMessageSchema.index({ isRead: 1 });

const SmsMessage: Model<ISmsMessage> =
  mongoose.models.SmsMessage ||
  mongoose.model<ISmsMessage>("SmsMessage", SmsMessageSchema);

export default SmsMessage;
