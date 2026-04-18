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
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

/** Build a regex from an SMS format template. */
function buildRegex(format: string, recipientNumber: string, amount: number): RegExp | null {
  if (!format?.trim()) return null;
  let escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/ /g, "\\s+");
  escaped = escaped
    .replace(/\\\{recipientNumber\\\}/g, recipientNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .replace(/\\\{amount\\\}/g, `(?:${amount}\\.?0*|${amount})`)
    .replace(/\\\{trxId\\\}/g, "(?<trxId>\\w+)")
    .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)");
  try { return new RegExp(escaped, "i"); } catch { return null; }
}

interface FailureMatch {
  matched: boolean;
  message: string;
}

/** Try to match rawSms against each failure template. Returns first match. */
function matchFailureTemplates(
  templates: { template: string; message: string }[],
  rawSms: string,
  recipientNumber: string,
  amount: number,
): FailureMatch | null {
  for (const ft of templates) {
    const regex = buildRegex(ft.template, recipientNumber, amount);
    if (regex && regex.test(rawSms)) {
      return { matched: true, message: ft.message };
    }
  }
  return null;
}

// POST /api/agent/queue/[jobId]/result
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    const body = await request.json();
    const { txId, rawSms, parsedResult: clientResult, ussdStepsExecuted } = body;

    await connectDB();

    const dbSession = await mongoose.startSession();

    // The agent now reports the definitive success/failure based on its own SMS matching.
    // We honour agent's decision but always re-validate server-side for safety.
    let isSuccess = clientResult?.success === true;
    let failureReason: string | undefined = clientResult?.reason;
    let finalParsedResult = { ...(clientResult || { success: isSuccess }) };

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);

        if (!job || !tx) throw new Error("Job or transaction not found");

        // ── Server-side SMS validation (authoritative) ───────────────────────────
        if (rawSms?.trim()) {
          // Get failure templates — prefer job-embedded snapshot, fall back to service
          let failureTemplates: { template: string; message: string }[] =
            (job.failureSmsTemplates as { template: string; message: string }[] | undefined) ?? [];

          // If not embedded, fetch from service
          if (failureTemplates.length === 0) {
            const svc = await Service.findById(job.serviceId).lean();
            if (svc?.failureSmsTemplates?.length) {
              failureTemplates = svc.failureSmsTemplates as { template: string; message: string }[];
            }
          }

          const successFormat = (job.successSmsFormat as string | undefined) ?? "";

          // 1. Try success template
          const sRegex = buildRegex(successFormat, job.recipientNumber, job.amount);
          const successMatch = sRegex ? rawSms.match(sRegex) : null;
          if (successMatch) {
            isSuccess = true;
            failureReason = undefined;
            finalParsedResult.success = true;
            if (successMatch.groups?.trxId) finalParsedResult.txRef = successMatch.groups.trxId;
            if (successMatch.groups?.balance) finalParsedResult.balance = successMatch.groups.balance;
          } else {
            // 2. Try each failure template
            const failureMatch = matchFailureTemplates(
              failureTemplates, rawSms, job.recipientNumber, job.amount
            );
            if (failureMatch) {
              isSuccess = false;
              failureReason = failureMatch.message;
              finalParsedResult.success = false;
              finalParsedResult.reason = failureMatch.message;
            } else if (failureTemplates.length > 0 || successFormat) {
              // SMS received but didn't match any pattern
              isSuccess = false;
              failureReason = "Transaction could not be confirmed — unrecognized SMS received.";
              finalParsedResult.success = false;
              finalParsedResult.reason = failureReason;
            } else {
              // No templates configured — trust the agent's reported result
              isSuccess = clientResult?.success === true;
              if (!isSuccess) {
                failureReason = clientResult?.reason || "Transaction failed.";
                finalParsedResult.reason = failureReason;
              }
            }
          }
        } else if (!rawSms?.trim()) {
          // No SMS received at all
          isSuccess = false;
          failureReason = clientResult?.reason || `No confirmation SMS received within ${job.smsTimeout}s.`;
          finalParsedResult.success = false;
          finalParsedResult.reason = failureReason;
        }

        // ── Persist updates ─────────────────────────────────────────────────────
        job.status = isSuccess ? "done" : "failed";
        job.locked = false;
        job.rawSms = rawSms;
        job.parsedResult = finalParsedResult;
        job.ussdStepsExecuted = ussdStepsExecuted || [];
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = isSuccess ? "complete" : "failed";
        if (!isSuccess && failureReason) (tx as any).failureReason = failureReason;
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        if (!isSuccess) {
          await User.findByIdAndUpdate(
            tx.userId,
            { $inc: { walletBalance: tx.amount }, walletLocked: false },
            { session: dbSession }
          );
        } else {
          await User.findByIdAndUpdate(tx.userId, { walletLocked: false }, { session: dbSession });
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

    await writeLog({
      action: isSuccess ? "TX_COMPLETED" : "TX_FAILED",
      entityId: txId,
      severity: isSuccess ? "info" : "warn",
      meta: { jobId, parsedResult: finalParsedResult, failureReason },
    });

    // Notify the user with the specific failure reason
    try {
      const tx = await Transaction.findById(txId).lean();
      if (tx) {
        if (isSuccess) {
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
