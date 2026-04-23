import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Transaction from "@/lib/db/models/Transaction";
import { hashPassword } from "@/lib/auth/password";
import { writeLog } from "@/lib/db/audit";
import { withUserSession } from "@/lib/auth/session";

// GET /api/user/subusers/[uid]
export async function GET(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  return withUserSession(request, async (session) => {
    const { uid } = await params;
    await connectDB();

    const user = await User.findOne({ _id: uid, parentId: session.sub }).select("-passwordHash").lean();
    if (!user) {
      return NextResponse.json({ error: "Sub-user not found" }, { status: 404 });
    }

    const txs = await Transaction.find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      user: {
        uid: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        walletBalance: user.walletBalance,
        creditLimit: user.creditLimit,
        walletLocked: user.walletLocked,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        phoneNumber: user.phoneNumber,
      },
      transactions: txs.map((t) => ({
        ...t,
        id: t._id,
      })),
    });
  });
}

// PATCH /api/user/subusers/[uid]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  return withUserSession(request, async (session) => {
    const { uid } = await params;
    const body = await request.json();
    const { action } = body;

    await connectDB();

    // Verify ownership
    const targetUser = await User.findOne({ _id: uid, parentId: session.sub });
    if (!targetUser) {
      return NextResponse.json({ error: "Sub-user not found" }, { status: 404 });
    }

    // ── Suspend / Activate ──────────────────────────────────────────────────
    if (action === "suspend" || action === "activate") {
      targetUser.status = action === "suspend" ? "suspended" : "active";
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: action === "suspend" ? "SUB_USER_SUSPENDED" : "SUB_USER_ACTIVATED",
        entityId: uid,
        meta: { targetUid: uid },
      });
      return NextResponse.json({ success: true, status: targetUser.status });
    }

    // ── Set Credit Limit ────────────────────────────────────────────────────
    if (action === "setCreditLimit") {
      const limit = Number(body.limit);
      if (isNaN(limit) || limit < 0) {
        return NextResponse.json({ error: "Invalid credit limit" }, { status: 400 });
      }
      targetUser.creditLimit = limit;
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: "SUB_USER_CREDIT_LIMIT_SET",
        entityId: uid,
        meta: { targetUid: uid, limit },
      });
      return NextResponse.json({ success: true, creditLimit: limit });
    }

    // ── Change Name ─────────────────────────────────────────────────────────
    if (action === "changeName") {
      const newName = String(body.displayName || "").trim();
      if (!newName) {
        return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
      }
      const oldName = targetUser.displayName;
      targetUser.displayName = newName;
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: "SUB_USER_NAME_CHANGED",
        entityId: uid,
        meta: { targetUid: uid, oldName, newName },
      });
      return NextResponse.json({ success: true, displayName: newName });
    }

    // ── Change Email ────────────────────────────────────────────────────────
    if (action === "changeEmail") {
      const newEmail = String(body.email || "").trim().toLowerCase();
      if (!newEmail || !newEmail.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      const existing = await User.findOne({ email: newEmail });
      if (existing && existing._id !== uid) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      const oldEmail = targetUser.email;
      targetUser.email = newEmail;
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: "SUB_USER_EMAIL_CHANGED",
        entityId: uid,
        meta: { targetUid: uid, oldEmail, newEmail },
      });
      return NextResponse.json({ success: true, email: newEmail });
    }

    // ── Change Password ─────────────────────────────────────────────────────
    if (action === "adminChangePassword") {
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      targetUser.passwordHash = await hashPassword(newPassword);
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: "SUB_USER_PASSWORD_CHANGED",
        entityId: uid,
        severity: "warn",
        meta: { targetUid: uid },
      });
      return NextResponse.json({ success: true });
    }

    // ── Change PIN ──────────────────────────────────────────────────────────
    if (action === "adminChangePin") {
      const newPin = String(body.pin || "");
      if (!/^\d{4,6}$/.test(newPin)) {
        return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
      }
      targetUser.pin = newPin;
      await targetUser.save();
      await writeLog({
        uid: session.sub,
        action: "SUB_USER_PIN_CHANGED",
        entityId: uid,
        severity: "warn",
        meta: { targetUid: uid },
      });
      return NextResponse.json({ success: true });
    }

    // ── Transfer Balance (Add / Deduct) ─────────────────────────────────────
    if (action === "transferBalance") {
      const { amount, type, note } = body; // type: "topup" or "deduct"
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      if (type !== "topup" && type !== "deduct") {
        return NextResponse.json({ error: "Invalid transfer type" }, { status: 400 });
      }

      const mSession = await mongoose.startSession();
      try {
        mSession.startTransaction();

        const parent = await User.findById(session.sub).session(mSession);
        const child = await User.findById(uid).session(mSession);

        if (!parent || !child) {
          throw new Error("User not found");
        }

        let newParentBalance = parent.walletBalance;
        let newChildBalance = child.walletBalance;

        if (type === "topup") {
          // Parent sends money to child
          if (parent.walletBalance + parent.creditLimit < numAmount) {
            throw new Error("Insufficient parent balance to topup sub-user");
          }
          newParentBalance -= numAmount;
          newChildBalance += numAmount;
        } else {
          // Parent deducts money from child (child returns to parent)
          if (child.walletBalance + child.creditLimit < numAmount) {
            throw new Error("Insufficient sub-user balance to deduct");
          }
          newChildBalance -= numAmount;
          newParentBalance += numAmount;
        }

        parent.walletBalance = newParentBalance;
        child.walletBalance = newChildBalance;

        await parent.save({ session: mSession });
        await child.save({ session: mSession });

        // Record child transaction
        await Transaction.create(
          [
            {
              userId: uid,
              type: type, // "topup" or "deduct"
              amount: numAmount,
              fee: 0,
              status: "complete",
              note: note || `Transferred from parent`,
              adminId: session.sub, // using adminId to track who issued the transfer
              createdAt: new Date(),
              completedAt: new Date(),
            },
          ],
          { session: mSession }
        );

        await mSession.commitTransaction();

        await writeLog({
          uid: session.sub,
          action: type === "topup" ? "SUB_USER_BALANCE_ADDED" : "SUB_USER_BALANCE_DEDUCTED",
          entityId: uid,
          meta: { targetUid: uid, amount: numAmount, parentNewBalance: newParentBalance, childNewBalance: newChildBalance, note },
        });

        return NextResponse.json({ success: true, walletBalance: newChildBalance });
      } catch (err: any) {
        await mSession.abortTransaction();
        return NextResponse.json({ error: err.message || "Transfer failed" }, { status: 400 });
      } finally {
        mSession.endSession();
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  });
}
