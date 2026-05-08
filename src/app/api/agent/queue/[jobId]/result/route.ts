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
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

// Maximum infra-failure retries before escalating to "waiting"
const MAX_INFRA_RETRIES = 5;

/** Build a regex from an SMS/USSD format template. */
function buildRegex(format: string, recipientNumber: string, amount: number): RegExp | null {
  if (!format?.trim()) return null;
  let escaped = format.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/\s+/g, "\\s+");
  const amountText = String(amount).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const amountWithOptionalSeparators = amountText.replace(/\\,/g, ",").replace(/\d/g, "$&[,]?");
  escaped = escaped
    .replace(/\\\{recipientNumber\\\}/g, recipientNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .replace(/\\\{amount\\\}/g, `(?:${amountWithOptionalSeparators}(?:\\.0+)?|${amountText}(?:\\.0+)?)`)
    .replace(/\\\{trxId\\\}/g, "(?<trxId>\\w+)")
    .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)")
    .replace(/\\\{[^\\}]+\\\}/g, ".*?");
  try { return new RegExp(escaped, "i"); } catch { return null; }
}

/** True if the success template contains a {trxId} placeholder. */
function templateRequiresTrxId(format: string): boolean {
  return format.includes("{trxId}");
}

/** Try to match rawSms against each failure template. Returns first match. */
function matchFailureTemplates(
  templates: { template: string; message: string }[],
  rawSms: string,
  recipientNumber: string,
  amount: number,
): { message: string } | null {
  for (const ft of templates) {
    const regex = buildRegex(ft.template, recipientNumber, amount);
    if (regex && regex.test(rawSms)) {
      return { message: ft.message };
    }
  }
  return null;
}

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
      parsedResult: clientResult,
      ussdStepsExecuted,
      serviceName: agentServiceName,
      recipientNumber: agentRecipientNumber,
      amount: agentAmount,
    } = body;

    await connectDB();

    const dbSession = await mongoose.startSession();

    // Determine whether USSD steps actually ran on the device
    const stepsRan = Array.isArray(ussdStepsExecuted) && ussdStepsExecuted.length > 0;
    const hasUssdResponse = typeof rawSms === "string" && rawSms.trim().length > 0;

    // Infrastructure failure: agent couldn't even dial USSD.
    // This happens when the app loses accessibility/phone permission mid-job,
    // or when the USSD call itself never connected.
    // Detection: no steps ran AND no USSD response AND agent reported failure.
    const isInfraFailure =
      !hasUssdResponse &&
      !stepsRan &&
      clientResult?.success === false;

    let outcome: FinalJobOutcome = "waiting";
    let isSuccess = false;
    let failureReason: string | undefined;
    let finalParsedResult: { success: boolean; [key: string]: unknown } = { success: false };
    let requeuedDueToInfra = false;

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);

        if (!job || !tx) throw new Error("Job or transaction not found");

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
        // Only runs when we have a real USSD response OR infra-failure escalation.
        if (!requeuedDueToInfra && !isInfraFailure) {
          // Load failure templates — prefer job snapshot, fall back to service
          let failureTemplates: { template: string; message: string }[] =
            (job.failureSmsTemplates as { template: string; message: string }[] | undefined) ?? [];
          if (failureTemplates.length === 0) {
            const svc = await Service.findById(job.serviceId).lean();
            if (svc?.failureSmsTemplates?.length) {
              failureTemplates = svc.failureSmsTemplates as { template: string; message: string }[];
            }
          }

          const successFormat = (job.successSmsFormat as string | undefined) ?? "";
          const requiresTrxId = templateRequiresTrxId(successFormat);

          if (hasUssdResponse) {
            // ── 1. Try success template ────────────────────────────────────────
            const sRegex = successFormat ? buildRegex(successFormat, job.recipientNumber, job.amount) : null;
            const successMatch = sRegex ? rawSms.match(sRegex) : null;

            if (successMatch) {
              // Template matched. If template requires a trxId, it must be captured.
              const capturedTrxId = successMatch.groups?.trxId;
              if (requiresTrxId && !capturedTrxId) {
                // Template has {trxId} but wasn't captured — treat as partial match → waiting
                outcome = "waiting";
                isSuccess = false;
                failureReason = "Success template matched but transaction ID could not be extracted.";
                finalParsedResult = { success: false, reason: failureReason };
              } else {
                // Clean success
                outcome = "done";
                isSuccess = true;
                failureReason = undefined;
                finalParsedResult = { success: true };
                if (capturedTrxId) finalParsedResult.txRef = capturedTrxId;
                if (successMatch.groups?.balance) finalParsedResult.balance = successMatch.groups.balance;
              }
            } else {
              // ── 2. Try failure templates ─────────────────────────────────────
              const failureMatch = matchFailureTemplates(
                failureTemplates, rawSms, job.recipientNumber, job.amount
              );
              if (failureMatch) {
                // Failure template matched → refund
                outcome = "failed";
                isSuccess = false;
                failureReason = failureMatch.message;
                finalParsedResult = { success: false, reason: failureReason };
              } else {
                // Neither template matched → manual review, no refund
                outcome = "waiting";
                isSuccess = false;
                failureReason = "USSD response did not match any configured success or failure template.";
                finalParsedResult = { success: false, reason: failureReason };
              }
            }
          } else {
            // USSD steps ran (stepsRan=true) but no response text captured,
            // OR we have no information at all. Manual review required.
            outcome = "waiting";
            isSuccess = false;
            failureReason = stepsRan
              ? "USSD steps executed but no response dialog text was captured."
              : "No USSD response received and no steps executed.";
            finalParsedResult = { success: false, reason: failureReason };
          }
        }

        if (requeuedDueToInfra) return; // already saved above

        // ── Persist final outcome ────────────────────────────────────────────────
        job.status = outcome;
        job.locked = false;
        job.rawSms = rawSms ?? "";
        job.parsedResult = finalParsedResult;
        job.ussdStepsExecuted = ussdStepsExecuted || [];   // latest attempt steps
        job.completedAt = new Date();

        // Append this attempt to the execution log so admins can see full history
        const logEntry = {
          attempt: job.attempt,
          ussdResponse: rawSms ?? "",
          outcome: outcome as string,
          failureReason: failureReason,
          deviceId: agentSession.deviceId,
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
