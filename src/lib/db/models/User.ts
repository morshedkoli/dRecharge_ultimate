import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "user" | "admin" | "super_admin" | "support_admin" | "agent";
export type UserStatus = "active" | "suspended";

export interface IUser extends Document<string> {
  _id: string;
  email: string;
  displayName: string;
  role: UserRole;
  walletBalance: number;
  walletLocked: boolean;
  status: UserStatus;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date;
  phoneNumber?: string;
  pin?: string;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["user", "admin", "super_admin", "support_admin", "agent"],
      default: "user",
    },
    walletBalance: { type: Number, default: 0 },
    walletLocked: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date, default: Date.now },
    phoneNumber: { type: String, default: null },
    pin: { type: String },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    _id: false,
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
