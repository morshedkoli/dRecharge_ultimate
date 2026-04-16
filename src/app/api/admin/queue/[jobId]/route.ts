import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

// GET /api/admin/queue/[jobId]
export async function GET(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async () => {
    const { jobId } = await params;
    await connectDB();
    const job = await ExecutionJob.findById(jobId).lean();
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  });
}

// PATCH /api/admin/queue/[jobId] — simulate result
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { jobId } = await params;
    const { txId, isSuccess } = await request.json();

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);
        if (!job || !tx) throw new Error("Not found");

        job.status = isSuccess ? "done" : "failed";
        job.locked = false;
        job.parsedResult = { success: isSuccess, reason: isSuccess ? undefined : "Admin simulated failure" };
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = isSuccess ? "complete" : "failed";
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        const userUpdate: Record<string, unknown> = { walletLocked: false };
        if (!isSuccess) userUpdate.$inc = { walletBalance: tx.amount };
        await User.findByIdAndUpdate(tx.userId, userUpdate, { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({ uid: session.sub, action: isSuccess ? "TX_COMPLETED" : "TX_FAILED", entityId: txId, meta: { jobId, simulated: true } });
    return NextResponse.json({ success: true });
  });
}
