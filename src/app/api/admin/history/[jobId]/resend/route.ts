import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { jobId } = await params;

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        if (!job) throw new Error("Job not found");

        if (job.status !== "waiting" && job.status !== "failed" && job.status !== "cancelled") {
          throw new Error(`Cannot resend a job with status "${job.status}"`);
        }

        // Reset the job back to queued state
        job.status = "queued";
        job.locked = false;
        job.lockedByDevice = undefined;
        job.lockedAt = undefined;
        job.simSlot = undefined;
        job.attempt = 0;
        job.rawSms = undefined;
        job.parsedResult = undefined;
        job.completedAt = undefined;
        await job.save({ session: dbSession });

        // Also reset the linked transaction back to pending so user history is accurate
        await Transaction.findByIdAndUpdate(
          job.txId,
          { status: "pending", $unset: { completedAt: 1, failureReason: 1 } },
          { session: dbSession }
        );
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: "JOB_RESENT",
      entityId: jobId,
      severity: "info",
      meta: { reason: "Admin manually resent job to queue" },
    });

    return NextResponse.json({ success: true });
  });
}
