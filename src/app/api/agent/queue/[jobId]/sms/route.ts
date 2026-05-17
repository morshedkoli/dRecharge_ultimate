import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import {
  notifyTransactionCompleted,
  notifyTransactionFailed,
  notifyTransactionWaiting,
} from "@/lib/notifications";
import { extractAgentSession } from "../../../_auth";
import { evaluateSmsAgainstTemplates, loadFailureTemplates, loadSuccessFormat } from "@/lib/sms-template";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

/**
 * POST /api/agent/queue/[jobId]/sms
 *
 * Called by the Android agent when it receives an SMS after USSD execution.
 * The job must be in "processing" status (awaiting SMS confirmation).
 * This endpoint matches the SMS against the service templates and resolves
 * the job to "done" or "failed" — no timeout involved.
 *
 * Body: { txId: string; rawSms: string }
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

    let outcome: string = "waiting";
    let failureReason: string | undefined;
    let finalParsedResult: { success: boolean; txRef?: string; amount?: number; reason?: string; balance?: string } = { success: false };
    let finalTxId = txId;
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
        if (!assignedServices.includes(job.serviceId)) throw new Error("Device is not assigned to this service");
        finalTxId = tx._id;

        // Only process jobs that are awaiting SMS (processing / waiting)
        if (!["processing", "waiting"].includes(job.status)) {
          return; // already resolved — ignore duplicate SMS
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
        outcome = result.outcome;
        failureReason = result.failureReason;
        finalParsedResult = result.parsedResult;

        // Persist resolution — keep the existing ussdResponse intact,
        // this endpoint only delivers the SMS body.
        job.status = outcome as any;
        job.locked = false;
        job.rawSms = rawSms;
        if (typeof smsSenderNumber === "string" && smsSenderNumber.trim()) {
          (job as any).smsSenderNumber = smsSenderNumber.trim();
        }
        if (smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime())) {
          (job as any).smsReceivedAt = smsReceivedAtDate;
        }
        job.parsedResult = { ...finalParsedResult, matchSource: "sms" as const };
        job.completedAt = outcome === "waiting" ? undefined : new Date();
        if (!job.executionLogs) (job as any).executionLogs = [];
        (job as any).executionLogs.push({
          attempt: job.attempt,
          ussdResponse: (job as any).ussdResponse ?? "",
          smsBody: rawSms,
          outcome,
          failureReason,
          deviceId: agentSession.deviceId,
          responseSource: "sms",
          senderNumber: smsSenderNumber,
          smsReceivedAt: smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime()) ? smsReceivedAtDate : undefined,
          stepsExecuted: job.ussdStepsExecuted || [],
          executedAt: new Date(),
        });
        await job.save({ session: dbSession });

        tx.status = outcome === "done" ? "complete" : outcome === "failed" ? "failed" : "waiting";
        if (outcome === "failed" && failureReason) (tx as any).failureReason = failureReason;
        if (outcome !== "waiting") tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        if (outcome === "failed") {
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );
        } else if (outcome === "done") {
          await User.findByIdAndUpdate(tx.userId, { walletLocked: false }, { session: dbSession });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    // Re-fetch for notifications
    const tx = await Transaction.findById(finalTxId || (await ExecutionJob.findById(jobId).lean())?.txId).lean();

    await writeLog({
      action: outcome === "done" ? "TX_COMPLETED" : outcome === "failed" ? "TX_FAILED" : "TX_WAITING",
      entityId: finalTxId,
      severity: outcome === "done" ? "info" : "warn",
      meta: { jobId, rawSms, outcome, failureReason },
    });

    try {
      if (tx) {
        if (outcome === "done") {
          await notifyTransactionCompleted(tx.userId, tx.amount, tx.recipientNumber ?? "");
        } else if (outcome === "failed") {
          await notifyTransactionFailed(tx.userId, tx.amount, tx.recipientNumber ?? "", failureReason);
        } else {
          await notifyTransactionWaiting(tx.userId, tx.amount, tx.recipientNumber ?? "", failureReason);
        }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, resolved: outcome });
  } catch (err) {
    console.error("SMS confirmation error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
