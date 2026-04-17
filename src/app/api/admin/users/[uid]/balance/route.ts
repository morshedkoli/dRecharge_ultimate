import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Transaction from "@/lib/db/models/Transaction";
import { writeLog } from "@/lib/db/audit";
import { notifyWalletCredited, notifyWalletDebited } from "@/lib/notifications";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ uid: string }> };

// POST /api/admin/users/[uid]/balance — add or deduct balance from a user's wallet
export async function POST(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { uid } = await params;
    const { amount, note, type } = await request.json();

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const isDeduct = type === "deduct";
    await connectDB();

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const user = await User.findById(uid).session(dbSession);
        if (!user) throw new Error("User not found");

        if (isDeduct && user.walletBalance < parsedAmount) {
          throw new Error(`Insufficient balance. Current: ৳${user.walletBalance.toFixed(2)}`);
        }

        user.walletBalance = isDeduct
          ? user.walletBalance - parsedAmount
          : user.walletBalance + parsedAmount;
        await user.save({ session: dbSession });

        await Transaction.create([{
          _id: nanoid(20),
          userId: uid,
          type: isDeduct ? "deduct" : "topup",
          amount: parsedAmount,
          fee: 0,
          status: "complete",
          note: note || "",
          adminId: session.sub,
          createdAt: new Date(),
          completedAt: new Date(),
        }], { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: isDeduct ? "ADMIN_DEDUCT" : "ADMIN_TOPUP",
      entityId: uid,
      severity: isDeduct ? "warn" : "info",
      meta: { targetUid: uid, amount: parsedAmount, note: note || "", type },
    });

    if (isDeduct) {
      await notifyWalletDebited(uid, parsedAmount, note);
    } else {
      await notifyWalletCredited(uid, parsedAmount, note);
    }

    return NextResponse.json({ success: true });
  });
}
