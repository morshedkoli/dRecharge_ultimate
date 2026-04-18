import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import { extractAgentSession } from "../_auth";

// GET /api/agent/queue — fetch next queued job
export async function GET(request: NextRequest) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const job = await ExecutionJob.findOne({ status: "queued" })
      .sort({ createdAt: 1 })
      .lean();

    if (!job) return NextResponse.json({ job: null });

    return NextResponse.json({
      job: {
        jobId: job._id,
        txId: job.txId,
        userId: job.userId,
        serviceId: job.serviceId,
        recipientNumber: job.recipientNumber,
        amount: job.amount,
        ussdSteps: job.ussdSteps,
        simSlot: job.simSlot ?? 1,
        smsTimeout: job.smsTimeout ?? 30,
        successSmsFormat: job.successSmsFormat,
        failureSmsTemplates: job.failureSmsTemplates ?? [],
        status: job.status,
        locked: job.locked,
        attempt: job.attempt,
        createdAt: job.createdAt,
      },
    });
  } catch (err) {
    console.error("Queue fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
