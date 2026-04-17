import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

// GET /api/admin/queue
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const raw = await ExecutionJob.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    // Map _id → jobId so the frontend type matches
    const jobs = raw.map((j) => ({ ...j, jobId: j._id }));
    return NextResponse.json({ jobs });
  });
}

// PATCH /api/admin/queue — fail a job manually
export async function PATCH(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { jobId, txId, reason } = await request.json();
    if (!jobId || !txId) {
      return NextResponse.json({ error: "jobId and txId required" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);
        if (!job || !tx) throw new Error("Job or transaction not found");

        job.status = "failed";
        job.locked = false;
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = "failed";
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        await User.findByIdAndUpdate(
          tx.userId,
          { $inc: { walletBalance: tx.amount }, walletLocked: false },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({ uid: session.sub, action: "TX_FAILED", entityId: txId, severity: "warn", meta: { reason, jobId } });
    return NextResponse.json({ success: true });
  });
}
