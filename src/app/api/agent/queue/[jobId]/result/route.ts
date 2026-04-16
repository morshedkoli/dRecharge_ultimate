import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { writeLog } from "@/lib/db/audit";
import { extractAgentSession } from "../../../_auth";
import mongoose from "mongoose";

type Params = { params: Promise<{ jobId: string }> };

function buildRegex(format: string, recipientNumber: string, amount: number): RegExp | null {
  if (!format) return null;
  let escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  escaped = escaped.replace(/ /g, "\\s+");
  escaped = escaped
    .replace(/\\\{recipientNumber\\\}/g, recipientNumber)
    .replace(/\\\{amount\\\}/g, `(?:${amount}\\.?0*|${amount})`)
    .replace(/\\\{trxId\\\}/g, "(?<trxId>\\w+)")
    .replace(/\\\{balance\\\}/g, "(?<balance>[0-9,.]+)");
  try { return new RegExp(escaped, "i"); } catch { return null; }
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
    let isSuccess = clientResult?.success === true;
    let finalParsedResult = clientResult || { success: isSuccess };

    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);

        if (!job || !tx) throw new Error("Job or transaction not found");

        // Server-side SMS validation
        if (rawSms && job.serviceId) {
          const svc = await Service.findById(job.serviceId).lean();
          if (svc) {
            const sRegex = buildRegex(svc.successSmsFormat, job.recipientNumber, job.amount);
            const fRegex = buildRegex(svc.failureSmsFormat, job.recipientNumber, job.amount);
            if (sRegex) {
              const m = rawSms.match(sRegex);
              if (m) {
                isSuccess = true;
                finalParsedResult.success = true;
                if (m.groups?.trxId) finalParsedResult.txRef = m.groups.trxId;
              } else if (fRegex && fRegex.test(rawSms)) {
                isSuccess = false;
                finalParsedResult.success = false;
                finalParsedResult.reason = "Matched failure format";
              } else {
                isSuccess = false;
                finalParsedResult.success = false;
                finalParsedResult.reason = "Unrecognized SMS format";
              }
            }
          }
        }

        job.status = isSuccess ? "done" : "failed";
        job.locked = false;
        job.rawSms = rawSms;
        job.parsedResult = finalParsedResult;
        job.ussdStepsExecuted = ussdStepsExecuted || [];
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = isSuccess ? "complete" : "failed";
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        const userUpdate: Record<string, unknown> = { walletLocked: false };
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
      meta: { jobId, parsedResult: finalParsedResult },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Report result error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
