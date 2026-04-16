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
    const { email, password, displayName, phoneNumber } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "");
    const normalizedName = String(displayName || "").trim();
    const normalizedPhone = String(phoneNumber || "").trim();

    if (!normalizedEmail || !normalizedPassword || !normalizedName) {
      return NextResponse.json(
        { error: "email, password, and displayName are required" },
        { status: 400 }
      );
    }
    if (normalizedPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const uid = nanoid(28);
    const passwordHash = await hashPassword(normalizedPassword);

    await User.create({
      _id: uid,
      email: normalizedEmail,
      displayName: normalizedName,
      role: "user",
      walletBalance: 0,
      walletLocked: false,
      status: "active",
      passwordHash,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      phoneNumber: normalizedPhone || undefined,
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
