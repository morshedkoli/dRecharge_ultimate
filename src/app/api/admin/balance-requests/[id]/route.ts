import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import BalanceRequest from "@/lib/db/models/BalanceRequest";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/balance-requests/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    const { action, adminNote } = await request.json();

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }
    if (action === "reject" && (!adminNote || adminNote.trim().length < 5)) {
      return NextResponse.json({ error: "adminNote required for rejection" }, { status: 400 });
    }

    await connectDB();

    if (action === "approve") {
      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          const req = await BalanceRequest.findById(id).session(dbSession);
          if (!req) throw new Error("Request not found");
          if (req.status !== "pending") throw new Error("Already processed");

          await User.findByIdAndUpdate(
            req.userId,
            { $inc: { walletBalance: req.amount } },
            { session: dbSession }
          );
          req.status = "approved";
          req.adminNote = adminNote || "";
          req.approvedBy = session.sub;
          req.processedAt = new Date();
          await req.save({ session: dbSession });
        });
      } finally {
        await dbSession.endSession();
      }
      await writeLog({ uid: session.sub, action: "BALANCE_REQUEST_APPROVED", entityId: id });
    } else {
      const req = await BalanceRequest.findById(id);
      if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (req.status !== "pending") return NextResponse.json({ error: "Already processed" }, { status: 409 });
      req.status = "rejected";
      req.adminNote = adminNote;
      req.approvedBy = session.sub;
      req.processedAt = new Date();
      await req.save();
      await writeLog({ uid: session.sub, action: "BALANCE_REQUEST_REJECTED", entityId: id, meta: { adminNote } });
    }

    return NextResponse.json({ success: true });
  });
}
