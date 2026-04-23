import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { getSession } from "@/lib/auth/session";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await request.json();
  const { action, status, txRef, reason } = body;

  await connectDB();
  
  const user = await User.findById(session.sub).lean();
  if (!user?.canManuallyCompleteJobs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbSession = await mongoose.startSession();
  try {
    let successMessage = "";
    await dbSession.withTransaction(async () => {
      const job = await ExecutionJob.findById(jobId).session(dbSession);
      if (!job) throw new Error("Job not found");

      if (action === "claim") {
        if (job.status !== "queued") throw new Error("Job is no longer queued");
        if (job.locked && job.lockedByUser !== session.sub) throw new Error("Job is locked by someone else");
        
        job.locked = true;
        job.lockedByUser = session.sub;
        job.lockedByDevice = `MANUAL:${session.sub}`;
        job.lockedAt = new Date();
        await job.save({ session: dbSession });
        successMessage = "Job claimed successfully";
      } 
      else if (action === "unmark") {
        if (job.lockedByUser !== session.sub) throw new Error("You do not own this job");
        
        job.locked = false;
        job.lockedByUser = undefined;
        job.lockedByDevice = undefined;
        job.lockedAt = undefined;
        await job.save({ session: dbSession });
        successMessage = "Job unmarked successfully";
      }
      else if (action === "complete") {
        if (job.lockedByUser !== session.sub) throw new Error("You do not own this job");
        
        const tx = await Transaction.findById(job.txId).session(dbSession);
        if (!tx) throw new Error("Transaction not found");

        const isSuccess = status === "done";
        
        job.status = isSuccess ? "done" : "failed";
        job.locked = false;
        job.parsedResult = { 
          success: isSuccess, 
          txRef: isSuccess ? txRef : undefined,
          reason: isSuccess ? undefined : (reason || "Manually marked as failed") 
        };
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = isSuccess ? "complete" : "failed";
        if (!isSuccess) (tx as any).failureReason = reason || "Manually marked as failed";
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        const userUpdate: Record<string, unknown> = { walletLocked: false };
        if (!isSuccess) userUpdate.$inc = { walletBalance: tx.amount };
        await User.findByIdAndUpdate(tx.userId, userUpdate, { session: dbSession });

        await writeLog({ 
          uid: session.sub, 
          action: isSuccess ? "MANUAL_JOB_COMPLETED" : "MANUAL_JOB_FAILED", 
          entityId: jobId, 
          meta: { txId: tx._id, txRef, reason } 
        });
        
        successMessage = `Job marked as ${isSuccess ? "done" : "failed"}`;
      }
      else {
        throw new Error("Invalid action");
      }
    });

    return NextResponse.json({ success: true, message: successMessage });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  } finally {
    await dbSession.endSession();
  }
}
