import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import {
  notifyTransactionCompleted,
  notifyTransactionFailed,
} from "@/lib/notifications";
import { extractAgentSession } from "../../../_auth";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

/** Build a regex from an SMS format template (mirrors result/route.ts). */
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
    const { txId, rawSms } = body as { txId: string; rawSms: string };

    if (!rawSms?.trim()) {
      return NextResponse.json({ error: "rawSms is required" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();

    let outcome: string = "failed";
    let failureReason: string | undefined;
    let finalParsedResult: { success: boolean; txRef?: string; amount?: number; reason?: string; balance?: string } = { success: false };

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = txId
          ? await Transaction.findById(txId).session(dbSession)
          : await Transaction.findById(job?.txId).session(dbSession);

        if (!job) throw new Error("Job not found");
        if (!tx) throw new Error("Transaction not found");

        // Only process jobs that are awaiting SMS (processing / waiting)
        if (!["processing", "waiting"].includes(job.status)) {
          return; // already resolved — ignore duplicate SMS
        }

        // Fetch failure templates
        let failureTemplates: { template: string; message: string }[] =
          (job.failureSmsTemplates as { template: string; message: string }[] | undefined) ?? [];
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
          outcome = "done";
          finalParsedResult = { success: true };
          if (successMatch.groups?.trxId) finalParsedResult.txRef = successMatch.groups.trxId;
          if (successMatch.groups?.balance) finalParsedResult.balance = successMatch.groups.balance;
        } else {
          // 2. Try failure templates
          let failureMatched = false;
          for (const ft of failureTemplates) {
            const fRegex = buildRegex(ft.template, job.recipientNumber, job.amount);
            if (fRegex && fRegex.test(rawSms)) {
              outcome = "failed";
              failureReason = ft.message;
              finalParsedResult = { success: false, reason: ft.message };
              failureMatched = true;
              break;
            }
          }

          if (!failureMatched) {
            if (successFormat) {
              // Has a success template but SMS didn't match either — keep waiting
              // Return early without resolving the job yet
              return;
            }
            // No templates configured — trust that SMS arrival means success
            outcome = "done";
            finalParsedResult = { success: true };
          }
        }

        // Persist resolution
        job.status = outcome as any;
        job.locked = false;
        job.rawSms = rawSms;
        job.parsedResult = finalParsedResult;
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = outcome === "done" ? "complete" : "failed";
        if (outcome === "failed" && failureReason) (tx as any).failureReason = failureReason;
        tx.completedAt = new Date();
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

    // Re-fetch for notifications
    const tx = await Transaction.findById(txId || (await ExecutionJob.findById(jobId).lean())?.txId).lean();

    await writeLog({
      action: outcome === "done" ? "TX_COMPLETED" : "TX_FAILED",
      entityId: txId,
      severity: outcome === "done" ? "info" : "warn",
      meta: { jobId, rawSms, outcome, failureReason },
    });

    try {
      if (tx) {
        if (outcome === "done") {
          await notifyTransactionCompleted(tx.userId, tx.amount, tx.recipientNumber ?? "");
        } else if (outcome === "failed") {
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
