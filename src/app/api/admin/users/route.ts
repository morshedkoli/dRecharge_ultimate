import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { hashPassword } from "@/lib/auth/password";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { nanoid } from "nanoid";

const ADMIN_ROLES = ["admin", "super_admin", "support_admin"];

// GET /api/admin/users — list all users
export async function GET(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    await connectDB();
    const users = await User.find({ role: { $ne: "agent" } })
      .select("-passwordHash")
      .sort({ createdAt: -1 } as any)
      .lean();

    const mapped = users.map((u) => ({
      uid: u._id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      walletBalance: u.walletBalance,
      walletLocked: u.walletLocked,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      phoneNumber: u.phoneNumber,
    }));

    return NextResponse.json({ users: mapped });
  });
}

// POST /api/admin/users — create user
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { email, password, displayName, phoneNumber, username, pin } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");
    const normalizedName = String(displayName || "").trim();
    const normalizedPhone = String(phoneNumber || "").trim();
    const normalizedPin = String(pin || "").trim();

    if (!normalizedName || !normalizedPassword) {
      return NextResponse.json(
        { error: "displayName and password are required" },
        { status: 400 }
      );
    }
    if (!normalizedEmail && !normalizedUsername) {
      return NextResponse.json(
        { error: "Either email or username must be provided" },
        { status: 400 }
      );
    }
    if (normalizedPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    if (normalizedPin && !/^\d{4,6}$/.test(normalizedPin)) {
      return NextResponse.json(
        { error: "PIN must be 4–6 digits" },
        { status: 400 }
      );
    }

    await connectDB();

    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail }).lean();
      if (existingEmail) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    
    if (normalizedUsername) {
      const existingUsername = await User.findOne({ username: normalizedUsername }).lean();
      if (existingUsername) return NextResponse.json({ error: "Username already in use" }, { status: 409 });
    }

    const uid = nanoid(28);
    const passwordHash = await hashPassword(normalizedPassword);

    await User.create({
      _id: uid,
      username: normalizedUsername || undefined,
      email: normalizedEmail || undefined,
      displayName: normalizedName,
      role: "user",
      walletBalance: 0,
      creditLimit: 0,
      walletLocked: false,
      status: "active",
      passwordHash,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      phoneNumber: normalizedPhone || undefined,
      pin: normalizedPin || undefined,
    });

    await writeLog({
      uid: session.sub,
      action: "USER_CREATED",
      entityId: uid,
      meta: { targetUid: uid, email: normalizedEmail, role: "user", source: "next_api" },
    });

    return NextResponse.json({ success: true, uid });
  });
}
