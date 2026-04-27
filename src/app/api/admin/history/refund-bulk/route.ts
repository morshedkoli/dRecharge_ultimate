import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { notifyTransactionCancelled } from "@/lib/notifications";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

// POST /api/admin/history/refund-bulk — cancel selected waiting jobs and refund users
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { jobIds } = await request.json();

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: "Invalid jobIds array" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();

    let refundedCount = 0;
    const refundedJobIds: string[] = [];

    try {
      await dbSession.withTransaction(async () => {
        // Only cancel jobs that are in a "waiting" state
        const jobs = await ExecutionJob.find({
          _id: { $in: jobIds },
          status: "waiting",
        }).session(dbSession);

        if (jobs.length === 0) {
          throw new Error("No eligible waiting jobs found to refund.");
        }

        for (const job of jobs) {
          const tx = await Transaction.findById(job.txId).session(dbSession);
          if (!tx) continue;

          // Cancel the job
          job.status = "cancelled";
          job.locked = false;
          job.completedAt = new Date();
          await job.save({ session: dbSession });

          // Mark transaction as failed (refunded)
          tx.status = "failed";
          (tx as any).failureReason = "Admin bulk refund";
          tx.completedAt = new Date();
          await tx.save({ session: dbSession });

          // Refund wallet + unlock
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );

          refundedJobIds.push(String(job._id));
          refundedCount++;
        }
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: "TX_BULK_REFUNDED",
      entityId: "bulk",
      severity: "warn",
      meta: { jobIds: refundedJobIds, count: refundedCount },
    });

    // Notify users (non-critical, best-effort)
    try {
      const cancelledJobs = await ExecutionJob.find({ _id: { $in: refundedJobIds } }).lean();
      for (const job of cancelledJobs) {
        const tx = await Transaction.findById(job.txId).lean();
        if (tx) await notifyTransactionCancelled(tx.userId, tx.amount).catch(() => {});
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, refundedCount });
  });
}
