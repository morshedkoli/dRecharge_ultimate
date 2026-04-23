import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { hashPassword } from "@/lib/auth/password";
import { nanoid } from "nanoid";
import { writeLog } from "@/lib/db/audit";

// Admin roles allowed to access dev quick-login routes
const ADMIN_ROLES = ["admin", "super_admin", "support_admin"];

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { role } = await request.json();
    if (!["admin", "user"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await connectDB();

    const email = role === "admin" ? "admin@finpay.com" : "user@finpay.com";
    const password = role === "admin" ? "admin123" : "user123";
    const displayName = role === "admin" ? "Super Admin" : "Regular User";
    const userRole = role === "admin" ? "super_admin" : "user";
    const walletBalance = role === "user" ? 500 : 0;

    const passwordHash = await hashPassword(password);
    const uid = `dev_${role}_${nanoid(8)}`;

    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          displayName,
          role: userRole,
          walletBalance,
          walletLocked: false,
          status: "active",
          passwordHash,
          lastLoginAt: new Date(),
        },
        $setOnInsert: {
          _id: uid,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    const redirectTo = ADMIN_ROLES.includes(userRole) ? "/admin/overview" : "/user/dashboard";

    await writeLog({
      action: "DEV_QUICK_LOGIN",
      severity: "warn",
      meta: { role, email },
    });

    return NextResponse.json({ email, password, redirectTo, role: userRole });
  } catch (error) {
    console.error("Quick login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
