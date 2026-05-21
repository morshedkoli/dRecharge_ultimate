import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { writeLog } from "@/lib/db/audit";
import { notifyTransactionCompleted, notifyTransactionFailed } from "@/lib/notifications";
import { extractAgentSession } from "../../../_auth";
import { evaluateSmsAgainstTemplates, loadFailureTemplates, loadSuccessFormat } from "@/lib/sms-template";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

type FinalOutcome = "done" | "failed";

const REASON_NETWORK_BUSY = "Network busy, please try again.";
const REASON_INFRA        = "Could not execute. Please try again.";
const REASON_UNCONFIRMED  = "Transaction could not be confirmed.";

// POST /api/agent/queue/[jobId]/result
//
// Only two terminal outcomes:
//   done   → tx complete, wallet stays debited, txRef + captured fields stored
//   failed → tx failed, wallet refunded, reason shown to user
//
// Failure reason precedence:
//   1. Matched failure-template message (specific provider error)
//   2. Generic "could not confirm" when response present but unmatched
//   3. "Network busy" when USSD ran but no response/SMS came back
//   4. Infra reason when the agent couldn't dial at all
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    const body = await request.json();
    const {
      txId,
      rawSms,
      ussdResponse: bodyUssdResponse,
      rawSmsSource,
      smsSenderNumber,
      smsReceivedAt,
      parsedResult: clientResult,
      ussdStepsExecuted,
      serviceName: agentServiceName,
      recipientNumber: agentRecipientNumber,
      amount: agentAmount,
    } = body;

    await connectDB();
    const dbSession = await mongoose.startSession();

    // ── Extract response text from agent payload ─────────────────────────────
    // Prefer the explicit ussdResponse field; fall back to the last "response"
    // step in ussdStepsExecuted; final fallback is rawSms when source=="ussd".
    const extractUssdResponse = (): string => {
      if (typeof bodyUssdResponse === "string" && bodyUssdResponse.trim()) {
        return bodyUssdResponse.trim();
      }
      if (Array.isArray(ussdStepsExecuted)) {
        for (let i = ussdStepsExecuted.length - 1; i >= 0; i--) {
          const step = ussdStepsExecuted[i] as { type?: string; value?: string };
          if (step?.type === "response" && typeof step.value === "string" && step.value.trim()) {
            return step.value.trim();
          }
        }
      }
      if (rawSmsSource === "ussd" && typeof rawSms === "string" && rawSms.trim()) {
        return rawSms.trim();
      }
      return "";
    };

    const ussdResponseText = extractUssdResponse();
    const smsBodyText =
      rawSmsSource === "sms" && typeof rawSms === "string" && rawSms.trim()
        ? rawSms.trim()
        : "";

    const stepsRan = Array.isArray(ussdStepsExecuted) && ussdStepsExecuted.length > 0;
    const hasAnyResponse = ussdResponseText.length > 0 || smsBodyText.length > 0;

    let outcome = "failed" as FinalOutcome;
    let isSuccess = false;
    let failureReason: string | undefined;
    let finalParsedResult: { success: boolean; [key: string]: unknown } = { success: false };
    let alreadyResolved = false;
    const responseSource = rawSmsSource === "sms" ? "sms" : "ussd";
    const smsReceivedAtDate =
      typeof smsReceivedAt === "number" && Number.isFinite(smsReceivedAt)
        ? new Date(smsReceivedAt)
        : typeof smsReceivedAt === "string" && smsReceivedAt.trim()
          ? new Date(smsReceivedAt)
          : undefined;

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        if (!job) throw new Error("Job not found");
        const tx = await Transaction.findById(txId || job.txId).session(dbSession);
        if (!tx) throw new Error("Transaction not found");
        if (job.txId !== tx._id) throw new Error("Job and transaction do not match");
        const assignedServices: string[] = agentSession.device.assignedServices ?? [];
        if (!assignedServices.includes(job.serviceId)) {
          throw new Error("Device is not assigned to this service");
        }

        // Duplicate-result: this job is already resolved (any prior state).
        // Just release the device and return — never reprocess wallets.
        if (!["processing", "waiting"].includes(job.status)) {
          alreadyResolved = ["done", "failed", "cancelled"].includes(job.status);
          if (alreadyResolved) {
            await AgentDevice.findByIdAndUpdate(
              agentSession.deviceId,
              { currentJob: null, lastHeartbeat: new Date(), status: "online" },
              { session: dbSession }
            );
            return;
          }
          throw new Error(`Cannot report result for job with status "${job.status}"`);
        }
        if (job.lockedByDevice !== agentSession.deviceId) {
          throw new Error("Job is not locked by this device");
        }

        // ── Determine outcome ────────────────────────────────────────────────
        let evaluatedSource: "ussd" | "sms" | null = null;

        if (hasAnyResponse) {
          const [successSmsFormat, failureTemplates] = await Promise.all([
            loadSuccessFormat(job),
            loadFailureTemplates(job),
          ]);

          let result =
            ussdResponseText.length > 0
              ? evaluateSmsAgainstTemplates({
                  rawSms: ussdResponseText,
                  recipientNumber: job.recipientNumber,
                  amount: job.amount,
                  successSmsFormat,
                  failureSmsTemplates: failureTemplates,
                })
              : null;
          if (result?.outcome === "done" || result?.outcome === "failed") {
            evaluatedSource = "ussd";
          }

          if ((!result || result.outcome !== "done") && smsBodyText.length > 0) {
            const smsResult = evaluateSmsAgainstTemplates({
              rawSms: smsBodyText,
              recipientNumber: job.recipientNumber,
              amount: job.amount,
              successSmsFormat,
              failureSmsTemplates: failureTemplates,
            });
            // SMS wins when it confirms success the USSD couldn't, OR when USSD
            // gave a generic failure but SMS gives a specific provider reason.
            if (smsResult.outcome === "done" || !result) {
              result = smsResult;
              evaluatedSource = "sms";
            }
          }

          // evaluateSmsAgainstTemplates always returns done/failed now
          outcome = result!.outcome;
          isSuccess = outcome === "done";
          failureReason = isSuccess ? undefined : result!.failureReason;
          finalParsedResult = {
            ...result!.parsedResult,
            ...(evaluatedSource ? { matchSource: evaluatedSource } : {}),
          };
        } else if (stepsRan) {
          // USSD steps ran but nothing came back — operator/network issue.
          outcome = "failed";
          isSuccess = false;
          failureReason = REASON_NETWORK_BUSY;
          finalParsedResult = { success: false, reason: failureReason };
        } else {
          // Agent couldn't even dial. No retries — refund immediately.
          outcome = "failed";
          isSuccess = false;
          failureReason = clientResult?.reason
            ? `${REASON_INFRA} (${clientResult.reason})`
            : REASON_INFRA;
          finalParsedResult = { success: false, reason: failureReason };
        }

        // ── Persist outcome on job ──────────────────────────────────────────
        job.status = outcome;
        job.locked = false;
        (job as any).ussdResponse = ussdResponseText;
        job.rawSms = smsBodyText;
        if (typeof smsSenderNumber === "string" && smsSenderNumber.trim()) {
          (job as any).smsSenderNumber = smsSenderNumber.trim();
        }
        if (smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime())) {
          (job as any).smsReceivedAt = smsReceivedAtDate;
        }
        job.parsedResult = finalParsedResult;
        job.ussdStepsExecuted = ussdStepsExecuted || [];
        job.completedAt = new Date();

        const logEntry = {
          attempt: job.attempt,
          ussdResponse: ussdResponseText,
          smsBody: smsBodyText,
          outcome: outcome as string,
          failureReason,
          deviceId: agentSession.deviceId,
          responseSource,
          senderNumber: typeof smsSenderNumber === "string" ? smsSenderNumber : undefined,
          smsReceivedAt:
            smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime())
              ? smsReceivedAtDate
              : undefined,
          stepsExecuted: ussdStepsExecuted || [],
          executedAt: new Date(),
        };
        if (!job.executionLogs) (job as any).executionLogs = [];
        (job as any).executionLogs.push(logEntry);

        await job.save({ session: dbSession });

        // ── Persist on transaction ──────────────────────────────────────────
        tx.status = outcome === "done" ? "complete" : "failed";
        if (outcome === "failed" && failureReason) {
          (tx as any).failureReason = failureReason;
        } else {
          (tx as any).failureReason = undefined;
        }
        tx.completedAt = new Date();

        // Capture txRef + extracted fields onto the transaction for success
        if (outcome === "done") {
          const pr = finalParsedResult as {
            txRef?: string;
            balance?: string;
            smsAmount?: string;
            smsRecipient?: string;
          };
          if (pr.txRef)        (tx as any).providerTxId   = pr.txRef;
          if (pr.balance)      (tx as any).providerBalance = pr.balance;
          if (pr.smsAmount)    (tx as any).providerAmount  = pr.smsAmount;
          if (pr.smsRecipient) (tx as any).providerRecipient = pr.smsRecipient;
        }
        await tx.save({ session: dbSession });

        // ── Wallet ──────────────────────────────────────────────────────────
        //   done   → unlock (money spent)
        //   failed → unlock + refund
        if (outcome === "failed") {
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );
        } else {
          await User.findByIdAndUpdate(
            tx.userId,
            { walletLocked: false },
            { session: dbSession }
          );
        }

        await AgentDevice.findByIdAndUpdate(
          agentSession.deviceId,
          { currentJob: null, lastHeartbeat: new Date(), status: "online" },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    if (alreadyResolved) {
      return NextResponse.json({ success: true, alreadyResolved: true });
    }

    // ── Audit + notify ─────────────────────────────────────────────────────────
    const tx = await Transaction.findById(txId).lean();
    const service = tx?.serviceId ? await Service.findById(tx.serviceId).lean() : null;
    const serviceName =
      (service as { name?: string } | null)?.name ||
      (typeof agentServiceName === "string" && agentServiceName.trim()) ||
      tx?.serviceId ||
      undefined;
    const recipientNumber =
      tx?.recipientNumber ||
      (typeof agentRecipientNumber === "string" && agentRecipientNumber.trim()) ||
      undefined;
    const amount =
      typeof tx?.amount === "number"
        ? tx.amount
        : typeof agentAmount === "number"
          ? agentAmount
          : Number.isFinite(Number(agentAmount))
            ? Number(agentAmount)
            : undefined;

    await writeLog({
      action: outcome === "done" ? "TX_COMPLETED" : "TX_FAILED",
      entityId: txId,
      severity: outcome === "done" ? "info" : "warn",
      meta: {
        jobId,
        serviceId: tx?.serviceId,
        serviceName,
        recipientNumber,
        amount,
        parsedResult: finalParsedResult,
        failureReason,
        outcome,
      },
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Report result error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
