import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const identifier = String(email || "").trim().toLowerCase();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/Email and password required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    }).lean();

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status === "suspended") {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    // Update last login
    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const token = await signSessionToken({
      sub: user._id as string,
      email: user.email || user.username || "",
      role: user.role,
      displayName: user.displayName,
    });

    const expiresInSeconds = 60 * 60 * 24 * 14; // 14 days
    (await cookies()).set("__session", token, {
      maxAge: expiresInSeconds,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({
      success: true,
      role: user.role,
      displayName: user.displayName,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  (await cookies()).delete("__session");
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  // Used by useAuth hook to get current user
  try {
    const token = request.cookies.get("__session")?.value;
    if (!token) return NextResponse.json({ user: null });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ user: null });

    await connectDB();
    const user = await User.findById(payload.sub).lean();
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: {
        uid: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        walletBalance: user.walletBalance,
        creditLimit: user.creditLimit ?? 0,
        walletLocked: user.walletLocked,
        status: user.status,
        phoneNumber: user.phoneNumber,
        pin: user.pin,
        parentId: user.parentId,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
