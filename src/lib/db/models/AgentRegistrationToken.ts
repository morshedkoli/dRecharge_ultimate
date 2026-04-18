import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAgentRegistrationToken extends Document<string> {
  _id: string; // tokenHash
  tokenHash: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedByDeviceId?: string;
  authUid?: string;
  authEmail?: string;
}

const AgentRegistrationTokenSchema = new Schema<IAgentRegistrationToken>(
  {
    _id: { type: String, required: true },
    tokenHash: { type: String, required: true },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
    usedByDeviceId: { type: String },
    authUid: { type: String },
    authEmail: { type: String },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

const AgentRegistrationToken: Model<IAgentRegistrationToken> =
  mongoose.models.AgentRegistrationToken ||
  mongoose.model<IAgentRegistrationToken>(
    "AgentRegistrationToken",
    AgentRegistrationTokenSchema
  );

export default AgentRegistrationToken;
