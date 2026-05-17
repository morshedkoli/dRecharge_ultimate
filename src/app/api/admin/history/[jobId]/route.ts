import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { notifyTransactionCancelled, notifyTransactionCompleted, notifyTransactionFailed } from "@/lib/notifications";
import { withAdminSession } from "@/lib/auth/session";
import { evaluateSmsAgainstTemplates, loadFailureTemplates } from "@/lib/sms-template";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

// GET /api/admin/history/[jobId]
export async function GET(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async () => {
    const { jobId } = await params;
    await connectDB();
    const raw = await ExecutionJob.findById(jobId).lean();
    if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const job = { ...raw, jobId: raw._id };
    return NextResponse.json({ job });
  });
}

// DELETE /api/admin/history/[jobId] — admin cancel job (refunds wallet)
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { jobId } = await params;
    const { reason } = await request.json().catch(() => ({ reason: "Admin cancelled" }));

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        if (!job) throw new Error("Job not found");
        if (job.status === "done" || job.status === "cancelled") {
          throw new Error(`Cannot cancel a job with status "${job.status}"`);
        }

        const tx = await Transaction.findById(job.txId).session(dbSession);
        if (!tx) throw new Error("Transaction not found");

        job.status = "cancelled";
        job.locked = false;
        job.completedAt = new Date();
        if (!job.executionLogs) (job as any).executionLogs = [];
        (job as any).executionLogs.push({
          attempt: job.attempt,
          ussdResponse: job.rawSms || "",
          outcome: "cancelled",
          failureReason: reason || "Admin cancelled",
          deviceId: session.sub,
          stepsExecuted: job.ussdStepsExecuted || [],
          executedAt: new Date(),
        });
        await job.save({ session: dbSession });

        tx.status = "failed";
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        // Refund wallet
        await User.findByIdAndUpdate(
          tx.userId,
          { $inc: { walletBalance: tx.amount }, walletLocked: false },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: "TX_CANCELLED",
      entityId: jobId,
      severity: "warn",
      meta: { reason: reason || "Admin cancelled" },
    });
    // Notify user — fetch tx for userId/amount
    try {
      const cancelledJob = await ExecutionJob.findById(jobId).lean();
      if (cancelledJob) {
        const tx = await Transaction.findById(cancelledJob.txId).lean();
        if (tx) await notifyTransactionCancelled(tx.userId, tx.amount);
      }
    } catch { /* non-critical */ }
    return NextResponse.json({ success: true });
  });
}

// PATCH /api/admin/history/[jobId] — admin complete / fail job
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { jobId } = await params;
    const { txId, isSuccess, txRef, senderNumber, note, rawSms } = await request.json();

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);
        if (!job || !tx) throw new Error("Not found");
        if (job.txId !== tx._id) throw new Error("Job and transaction do not match");

        let parsedResult = {
          success: Boolean(isSuccess),
          txRef: txRef || undefined,
          senderNumber: senderNumber || undefined,
          reason: isSuccess
            ? (note || undefined)
            : (note || "Admin marked as failed"),
        };
        let failureReason = note || "Admin marked as failed";

        if (isSuccess) {
          const responseText = String(rawSms || note || "").trim();
          if (!responseText) {
            throw new Error("Gateway SMS/USSD response is required to complete a job");
          }
          const templateResult = evaluateSmsAgainstTemplates({
            rawSms: responseText,
            recipientNumber: job.recipientNumber,
            amount: job.amount,
            successSmsFormat: job.successSmsFormat,
            failureSmsTemplates: await loadFailureTemplates(job),
          });
          if (templateResult.outcome !== "done") {
            throw new Error(templateResult.failureReason || "Gateway response did not match the service success template");
          }
          parsedResult = {
            success: true,
            txRef: templateResult.parsedResult.txRef || txRef || undefined,
            senderNumber: senderNumber || undefined,
            reason: undefined,
          };
          failureReason = "";
          job.rawSms = responseText;
        }

        job.status = isSuccess ? "done" : "failed";
        job.locked = false;
        if (!isSuccess && rawSms) job.rawSms = String(rawSms);
        job.parsedResult = parsedResult;
        job.completedAt = new Date();
        if (!job.executionLogs) (job as any).executionLogs = [];
        (job as any).executionLogs.push({
          attempt: job.attempt,
          ussdResponse: isSuccess ? (job.rawSms || rawSms || note || "") : (rawSms || job.rawSms || ""),
          outcome: isSuccess ? "done" : "failed",
          failureReason: isSuccess ? undefined : failureReason,
          deviceId: session.sub,
          responseSource: "sms",
          senderNumber: senderNumber || undefined,
          stepsExecuted: job.ussdStepsExecuted || [],
          executedAt: new Date(),
        });
        await job.save({ session: dbSession });

        tx.status = isSuccess ? "complete" : "failed";
        if (!isSuccess) (tx as any).failureReason = failureReason;
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        const userUpdate: Record<string, unknown> = { walletLocked: false };
        if (!isSuccess) userUpdate.$inc = { walletBalance: tx.amount };
        await User.findByIdAndUpdate(tx.userId, userUpdate, { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: isSuccess ? "TX_COMPLETED" : "TX_FAILED",
      entityId: txId,
      meta: { jobId, adminCompleted: true, txRef, senderNumber, note },
    });

    // Notify the user about the manual resolution
    try {
      const resolvedTx = await Transaction.findById(txId).lean();
      if (resolvedTx) {
        if (isSuccess) {
          await notifyTransactionCompleted(
            resolvedTx.userId,
            resolvedTx.amount,
            resolvedTx.recipientNumber ?? ""
          );
        } else {
          await notifyTransactionFailed(
            resolvedTx.userId,
            resolvedTx.amount,
            resolvedTx.recipientNumber ?? "",
            note || "Admin marked as failed"
          );
        }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
  });
}
