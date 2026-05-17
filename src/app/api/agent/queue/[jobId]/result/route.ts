import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { writeLog } from "@/lib/db/audit";
import { notifyTransactionCompleted, notifyTransactionFailed, notifyTransactionWaiting } from "@/lib/notifications";
import { extractAgentSession } from "../../../_auth";
import { evaluateSmsAgainstTemplates, loadFailureTemplates, loadSuccessFormat } from "@/lib/sms-template";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

// Maximum infra-failure retries before escalating to "waiting"
const MAX_INFRA_RETRIES = 5;

type FinalJobOutcome = "done" | "failed" | "waiting" | "queued";

// POST /api/agent/queue/[jobId]/result
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

    // Extract USSD dialog text:
    //   1. Prefer the explicit ussdResponse field from the agent
    //   2. Fall back to the last "response" step in ussdStepsExecuted
    //   3. Final fallback: if rawSmsSource === "ussd", rawSms holds the dialog text
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
    // smsBody is only what came over SMS — never the USSD dialog
    const smsBodyText =
      rawSmsSource === "sms" && typeof rawSms === "string" && rawSms.trim()
        ? rawSms.trim()
        : "";

    // Determine whether USSD steps actually ran on the device
    const stepsRan = Array.isArray(ussdStepsExecuted) && ussdStepsExecuted.length > 0;
    const hasAnyResponse = ussdResponseText.length > 0 || smsBodyText.length > 0;

    // Infrastructure failure: agent couldn't even dial USSD.
    // Detection: no steps ran AND no response captured AND agent reported failure.
    const isInfraFailure =
      !hasAnyResponse &&
      !stepsRan &&
      clientResult?.success === false;

    let outcome: FinalJobOutcome = "waiting";
    let isSuccess = false;
    let failureReason: string | undefined;
    let finalParsedResult: { success: boolean; [key: string]: unknown } = { success: false };
    let requeuedDueToInfra = false;
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
        if (!assignedServices.includes(job.serviceId)) throw new Error("Device is not assigned to this service");
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
        if (job.lockedByDevice !== agentSession.deviceId) throw new Error("Job is not locked by this device");

        // ── Infrastructure failure: requeue or escalate ──────────────────────────
        // When the agent app lost connectivity / accessibility, we should NOT
        // refund the user. Instead put the job back in queue for the next agent
        // tick. After MAX_INFRA_RETRIES we escalate to "waiting" for manual review.
        if (isInfraFailure) {
          // Always log the infra attempt so admin can see what happened
          const infraLogEntry = {
            attempt: job.attempt,
            ussdResponse: rawSms ?? "",
            outcome: job.attempt < MAX_INFRA_RETRIES ? "queued" : "waiting",
            failureReason: clientResult?.reason || "Agent could not execute USSD (system/permission error)",
            deviceId: agentSession.deviceId,
            stepsExecuted: ussdStepsExecuted || [],
            executedAt: new Date(),
          };

          if (job.attempt < MAX_INFRA_RETRIES) {
            // Requeue for retry
            job.status = "queued";
            job.locked = false;
            (job as any).lockedAt = undefined;
            (job as any).lockedByDevice = undefined;
            (job as any).lockedByUser = undefined;
            // Persist whatever we captured so admin can inspect retries
            if (ussdResponseText) (job as any).ussdResponse = ussdResponseText;
            if (smsBodyText) job.rawSms = smsBodyText;
            if (!job.executionLogs) (job as any).executionLogs = [];
            (job as any).executionLogs.push(infraLogEntry);
            await job.save({ session: dbSession });

            // Release device
            await AgentDevice.findByIdAndUpdate(
              agentSession.deviceId,
              { currentJob: null, lastHeartbeat: new Date(), status: "online" },
              { session: dbSession }
            );

            requeuedDueToInfra = true;
            return; // exit transaction — job is requeued, no wallet changes
          }

          // Too many infra failures — escalate to waiting for manual review
          outcome = "waiting";
          isSuccess = false;
          failureReason = `Agent could not execute the job after ${job.attempt} attempt(s). Manual review required.`;
          finalParsedResult = { success: false, reason: failureReason };
        }

        // ── Template-based outcome determination ─────────────────────────────────
        // Evaluate templates against BOTH the USSD dialog text and the SMS body.
        // Either input can confirm/fail the job — we try USSD first (immediate
        // confirmation), then SMS (async confirmation for SMS-only services).
        if (!requeuedDueToInfra && !isInfraFailure) {
          if (hasAnyResponse) {
            const [successSmsFormat, failureTemplates] = await Promise.all([
              loadSuccessFormat(job),
              loadFailureTemplates(job),
            ]);

            // Try USSD dialog text first
            let evaluatedSource: "ussd" | "sms" | null = null;
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
            if (result && result.outcome !== "waiting") {
              evaluatedSource = "ussd";
            }

            // If USSD didn't conclusively match, try the SMS body
            if ((!result || result.outcome === "waiting") && smsBodyText.length > 0) {
              const smsResult = evaluateSmsAgainstTemplates({
                rawSms: smsBodyText,
                recipientNumber: job.recipientNumber,
                amount: job.amount,
                successSmsFormat,
                failureSmsTemplates: failureTemplates,
              });
              if (smsResult.outcome !== "waiting" || !result) {
                result = smsResult;
                if (smsResult.outcome !== "waiting") evaluatedSource = "sms";
              }
            }

            if (!result) {
              // Shouldn't happen because hasAnyResponse is true, but be safe.
              result = {
                outcome: "waiting",
                parsedResult: { success: false, reason: "No response to evaluate" },
                failureReason: "No response to evaluate",
              };
            }

            outcome = result.outcome;
            isSuccess = result.outcome === "done";
            failureReason = result.failureReason;
            finalParsedResult = {
              ...result.parsedResult,
              ...(evaluatedSource ? { matchSource: evaluatedSource } : {}),
            };
          } else {
            // USSD steps ran but nothing captured. Manual review required.
            outcome = "waiting";
            isSuccess = false;
            failureReason = stepsRan
              ? "USSD steps executed but no response dialog text or SMS was captured."
              : "No USSD response received and no steps executed.";
            finalParsedResult = { success: false, reason: failureReason };
          }
        }

        if (requeuedDueToInfra) return; // already saved above

        // ── Persist final outcome ────────────────────────────────────────────────
        job.status = outcome;
        job.locked = false;
        // Store dialog text and SMS body separately so admin can see both.
        (job as any).ussdResponse = ussdResponseText;
        job.rawSms = smsBodyText;
        if (typeof smsSenderNumber === "string" && smsSenderNumber.trim()) {
          (job as any).smsSenderNumber = smsSenderNumber.trim();
        }
        if (smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime())) {
          (job as any).smsReceivedAt = smsReceivedAtDate;
        }
        job.parsedResult = finalParsedResult;
        job.ussdStepsExecuted = ussdStepsExecuted || [];   // latest attempt steps
        job.completedAt = outcome === "waiting" ? undefined : new Date();

        // Append this attempt to the execution log so admins can see full history
        const logEntry = {
          attempt: job.attempt,
          ussdResponse: ussdResponseText,
          smsBody: smsBodyText,
          outcome: outcome as string,
          failureReason: failureReason,
          deviceId: agentSession.deviceId,
          responseSource,
          senderNumber: typeof smsSenderNumber === "string" ? smsSenderNumber : undefined,
          smsReceivedAt: smsReceivedAtDate && !Number.isNaN(smsReceivedAtDate.getTime()) ? smsReceivedAtDate : undefined,
          stepsExecuted: ussdStepsExecuted || [],
          executedAt: new Date(),
        };
        if (!job.executionLogs) (job as any).executionLogs = [];
        (job as any).executionLogs.push(logEntry);

        await job.save({ session: dbSession });

        // Map job outcome → transaction status
        const txStatus = outcome === "done" ? "complete"
                       : outcome === "failed" ? "failed"
                       : "waiting";
        tx.status = txStatus;
        if (outcome !== "done" && failureReason) (tx as any).failureReason = failureReason;
        if (outcome !== "waiting") tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        // Wallet:
        //   done    → just unlock (money spent, service delivered)
        //   failed  → unlock + full refund
        //   waiting → keep locked (manual admin decision pending)
        if (outcome === "failed") {
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );
        } else if (outcome === "done") {
          await User.findByIdAndUpdate(tx.userId, { walletLocked: false }, { session: dbSession });
        }
        // "waiting" → wallet stays locked until admin resolves

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

    // Short-circuit: job was requeued, no notifications needed
    if (requeuedDueToInfra) {
      await writeLog({
        action: "JOB_REQUEUED",
        entityId: jobId,
        severity: "info",
        meta: {
          jobId,
          deviceId: agentSession.deviceId,
          reason: "Infrastructure failure — requeued for retry",
        },
      });
      return NextResponse.json({ success: true, requeued: true });
    }

    // ── Audit log ──────────────────────────────────────────────────────────────
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

    const finalOutcome = outcome as string;
    const logAction =
      finalOutcome === "done" ? "TX_COMPLETED"
      : finalOutcome === "failed" ? "TX_FAILED"
      : "TX_WAITING";

    await writeLog({
      action: logAction,
      entityId: txId,
      severity: finalOutcome === "done" ? "info" : "warn",
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

    // ── User notifications ─────────────────────────────────────────────────────
    try {
      if (tx) {
        if (finalOutcome === "done") {
          await notifyTransactionCompleted(tx.userId, tx.amount, tx.recipientNumber ?? "");
        } else if (finalOutcome === "failed") {
          await notifyTransactionFailed(tx.userId, tx.amount, tx.recipientNumber ?? "", failureReason);
        } else {
          await notifyTransactionWaiting(tx.userId, tx.amount, tx.recipientNumber ?? "", failureReason);
        }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Report result error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
