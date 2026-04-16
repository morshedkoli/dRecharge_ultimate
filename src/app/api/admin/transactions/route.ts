import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Transaction from "@/lib/db/models/Transaction";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import { getSession } from "@/lib/auth/session";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

// GET /api/admin/transactions
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({ transactions });
  });
}

// POST /api/admin/transactions — user-initiated transaction
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { serviceId, recipientNumber, amount } = await request.json();
    if (!serviceId || !recipientNumber || !amount || amount <= 0) {
      return NextResponse.json({ error: "serviceId, recipientNumber, amount required" }, { status: 400 });
    }

    const uid = session.sub;
    await connectDB();

    const service = await Service.findById(serviceId).lean();
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    if (!service.isActive) return NextResponse.json({ error: "Service is currently inactive" }, { status: 400 });

    const dbSession = await mongoose.startSession();
    let txId = "";
    let jobId = "";

    try {
      await dbSession.withTransaction(async () => {
        const user = await User.findById(uid).session(dbSession);
        if (!user) throw new Error("User not found");
        if (user.walletLocked) throw new Error("Wallet is locked by another transaction. Please wait.");
        if (user.walletBalance < amount) throw new Error("Insufficient balance");

        txId = "TX_" + nanoid(20);
        jobId = "JOB_" + nanoid(20);

        const ussdFlowTemplate = service.ussdFlow || "";
        const pin = service.pin || "";
        const parsedUssdFlow = ussdFlowTemplate
          .replace(/{recipientNumber}/gi, recipientNumber)
          .replace(/{amount}/gi, amount.toString())
          .replace(/{pin}/gi, pin);

        await Transaction.create([{
          _id: txId,
          userId: uid,
          type: "send",
          serviceId,
          recipientNumber,
          amount,
          fee: 0,
          status: "pending",
          createdAt: new Date(),
        }], { session: dbSession });

        await ExecutionJob.create([{
          _id: jobId,
          txId,
          userId: uid,
          serviceId,
          recipientNumber,
          amount,
          ussdFlow: parsedUssdFlow,
          rawUssdFlow: ussdFlowTemplate,
          successSmsFormat: service.successSmsFormat || "",
          failureSmsFormat: service.failureSmsFormat || "",
          status: "queued",
          locked: false,
          attempt: 0,
          createdAt: new Date(),
        }], { session: dbSession });

        user.walletBalance -= amount;
        user.walletLocked = true;
        await user.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({ uid, action: "TX_INITIATED", entityId: txId, meta: { serviceId, amount } });
    return NextResponse.json({ success: true, txId, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
