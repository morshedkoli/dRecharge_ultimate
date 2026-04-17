import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Transaction from "@/lib/db/models/Transaction";
import { writeLog } from "@/lib/db/audit";
import {
  notifyAccountSuspended,
  notifyAccountActivated,
  notifyRoleChanged,
  notifyWalletCredited,
} from "@/lib/notifications";
import { withAdminSession } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import mongoose from "mongoose";

type Params = { params: Promise<{ uid: string }> };

// PATCH /api/admin/users/[uid] — supports both admin actions and self-service
export async function PATCH(request: NextRequest, { params }: Params) {
  const { uid } = await params;
  const body = await request.json();
  const { action } = body;

  // Self-service actions (changePassword, setPin) — only for self
  if (action === "changePassword" || action === "setPin") {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.sub !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectDB();
    const user = await User.findById(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "changePassword") {
      const { currentPassword, newPassword } = body;
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      return NextResponse.json({ success: true });
    }

    if (action === "setPin") {
      user.pin = body.pin;
      await user.save();
      return NextResponse.json({ success: true });
    }
  }

  // All other actions are admin-only
  return withAdminSession(request, async (session) => {
    const { role, amount, note } = body;

    await connectDB();

    const user = await User.findById(uid);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "suspend") {
      user.status = "suspended";
      await user.save();
      await writeLog({ uid: session.sub, action: "USER_SUSPENDED", entityId: uid, severity: "warn", meta: { targetUid: uid } });
      await notifyAccountSuspended(uid);
      return NextResponse.json({ success: true });
    }

    if (action === "activate") {
      user.status = "active";
      await user.save();
      await writeLog({ uid: session.sub, action: "USER_ACTIVATED", entityId: uid, meta: { targetUid: uid } });
      await notifyAccountActivated(uid);
      return NextResponse.json({ success: true });
    }

    if (action === "setRole") {
      const validRoles = ["user", "admin", "super_admin", "support_admin"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      user.role = role;
      await user.save();
      await writeLog({ uid: session.sub, action: "ROLE_CHANGED", entityId: uid, severity: "warn", meta: { targetUid: uid, newRole: role } });
      await notifyRoleChanged(uid, role);
      return NextResponse.json({ success: true });
    }

    if (action === "addBalance") {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Positive amount required" }, { status: 400 });
      }
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          await User.findByIdAndUpdate(uid, { $inc: { walletBalance: amount } }, { session: dbSession });
          await Transaction.create([{
            _id: `TX_TOPUP_${Date.now()}`,
            userId: uid,
            type: "topup",
            amount,
            fee: 0,
            status: "complete",
            note: note || `Admin top-up by ${session.displayName}`,
            adminId: session.sub,
            createdAt: new Date(),
            completedAt: new Date(),
          }], { session: dbSession });
        });
      } finally {
        await dbSession.endSession();
      }
      await writeLog({ uid: session.sub, action: "ADMIN_TOPUP", entityId: uid, meta: { targetUid: uid, amount, note } });
      await notifyWalletCredited(uid, amount, note);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}


// GET /api/admin/users/[uid]
export async function GET(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { uid } = await params;
    await connectDB();
    
    const user = await User.findById(uid).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const transactions = await Transaction.find({ userId: uid })
      .sort({ createdAt: -1 } as any)
      .lean();
      
    const requests = await mongoose.models.BalanceRequest?.find({ userId: uid })
      .sort({ createdAt: -1 } as any)
      .lean() || [];
      
    return NextResponse.json({
      user: {
        uid: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        walletBalance: user.walletBalance,
        walletLocked: user.walletLocked,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        phoneNumber: user.phoneNumber,
        pin: user.pin
      },
      transactions: transactions.map(t => ({ id: t._id, ...t })),
      requests: requests.map(r => ({ id: r._id, ...r }))
    });
  });
}

// DELETE /api/admin/users/[uid]
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { uid } = await params;
    await connectDB();
    await User.findByIdAndDelete(uid);
    await writeLog({ uid: session.sub, action: "USER_DELETED", entityId: uid, severity: "warn", meta: { targetUid: uid } });
    return NextResponse.json({ success: true });
  });
}
