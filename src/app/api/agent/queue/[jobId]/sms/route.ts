import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { notifyTransactionCompleted, notifyTransactionFailed } from "@/lib/notifications";
import { extractAgentSession } from "../../../_auth";
import { evaluateSmsAgainstTemplates, loadFailureTemplates, loadSuccessFormat } from "@/lib/sms-template";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/agent/queue/[jobId]/sms
 *
 * Late SMS arrival path. Only acts on jobs still in "processing" — the result
 * endpoint will normally have already resolved the job. Always lands on
 * done or failed; never on a waiting state.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    const body = await request.json();
    const { txId, rawSms, smsSenderNumber, smsReceivedAt } = body as {
      txId: string;
      rawSms: string;
      smsSenderNumber?: string;
      smsReceivedAt?: number | string;
    };

    if (!rawSms?.trim()) {
      return NextResponse.json({ error: "rawSms is required" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();

    let outcome = "failed" as "done" | "failed";
    let failureReason: string | undefined;
    let finalParsedResult: {
      success: boolean;
      txRef?: string;
      balance?: string;
      smsAmount?: string;
      smsRecipient?: string;
      reason?: string;
    } = { success: false };
    let finalTxId = txId;
    let resolvedHere = false;
    const smsReceivedAtDate =
      typeof smsReceivedAt === "number" && Number.isFinite(smsReceivedAt)
        ? new Date(smsReceivedAt)
        : typeof smsReceivedAt === "string" && smsReceivedAt.trim()
          ? new Date(smsReceivedAt)
          : undefined;

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = txId
          ? await Transaction.findById(txId).session(dbSession)
          : await Transaction.findById(job?.txId).session(dbSession);

        if (!job) throw new Error("Job not found");
        if (!tx) throw new Error("Transaction not found");
        if (job.txId !== tx._id) throw new Error("Job and transaction do not match");
        if (job.lockedByDevice !== agentSession.deviceId) throw new Error("Job is not locked by this device");
        const assignedServices: string[] = agentSession.device.assignedServices ?? [];
        if (!assignedServices.includes(job.serviceId)) {
          throw new Error("Device is not assigned to this service");
        }
        finalTxId = tx._id;

        // Only act on jobs still awaiting resolution. If /result already
        // resolved the job to done/failed, ignore this late SMS.
        if (!["processing", "waiting"].includes(job.status)) {
          return;
        }

        const [successSmsFormat, failureTemplates] = await Promise.all([
          loadSuccessFormat(job),
          loadFailureTemplates(job),
        ]);
        const result = evaluateSmsAgainstTemplates({
          rawSms,
          recipientNumber: job.recipientNumber,
          amount: job.amount,
          successSmsFormat,
          failureSmsTemplates: failureTemplates,
        });
        outcome = result.outcome; // "done" | "failed"
        failureReason = outcome === "failed" ? result.failureReason : undefined;
        finalParsedResult = result.parsedResult;
        resolvedHere = true;

        job.status = outcome;
        job.locked = false;
        job.rawSms = rawSms;
        if (typeof smsSenderNumber === "string" && smsSenderNumber.trim()) {
          (job as any).smsSenderNumber = smsSenderNumber.trim();
        }
        if (smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime())) {
          (job as any).smsReceivedAt = smsReceivedAtDate;
        }
        job.parsedResult = { ...finalParsedResult, matchSource: "sms" as const };
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = outcome === "done" ? "complete" : "failed";
        if (outcome === "failed" && failureReason) {
          (tx as any).failureReason = failureReason;
        } else {
          (tx as any).failureReason = undefined;
        }
        tx.completedAt = new Date();

        if (outcome === "done") {
          const pr = finalParsedResult;
          if (pr.txRef)        (tx as any).providerTxId      = pr.txRef;
          if (pr.balance)      (tx as any).providerBalance   = pr.balance;
          if (pr.smsAmount)    (tx as any).providerAmount    = pr.smsAmount;
          if (pr.smsRecipient) (tx as any).providerRecipient = pr.smsRecipient;
        }
        await tx.save({ session: dbSession });

        if (outcome === "failed") {
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );
        } else {
          await User.findByIdAndUpdate(tx.userId, { walletLocked: false }, { session: dbSession });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    if (!resolvedHere) {
      return NextResponse.json({ success: true, alreadyResolved: true });
    }

    const tx = await Transaction.findById(finalTxId).lean();

    await writeLog({
      action: outcome === "done" ? "TX_COMPLETED" : "TX_FAILED",
      entityId: finalTxId,
      severity: outcome === "done" ? "info" : "warn",
      meta: { jobId, rawSms, outcome, failureReason },
    });

    try {
      if (tx) {
        if (outcome === "done") {
          await notifyTransactionCompleted(tx.userId, tx.amount, tx.recipientNumber ?? "");
        } else {
          await notifyTransactionFailed(tx.userId, tx.amount, tx.recipientNumber ?? "", failureReason);
        }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, resolved: outcome });
  } catch (err) {
    console.error("SMS confirmation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
