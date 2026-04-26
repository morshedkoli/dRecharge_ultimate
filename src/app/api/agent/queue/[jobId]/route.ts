import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Service from "@/lib/db/models/Service";
import { extractAgentSession } from "../../_auth";
import { resolveJobUssdSteps } from "@/lib/ussd";

type Params = { params: Promise<{ jobId: string }> };

// GET /api/agent/queue/[jobId]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    await connectDB();
    const job = await ExecutionJob.findById(jobId).lean();
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const service = await Service.findById(job.serviceId).lean();
    const ussdSteps = resolveJobUssdSteps({
      ...(service as { ussdSteps?: unknown; ussdFlow?: unknown; pin?: unknown } | null ?? {}),
      ussdSteps: job.ussdSteps,
      recipientNumber: job.recipientNumber,
      amount: job.amount,
    });

    return NextResponse.json({
      job: {
        jobId: job._id,
        txId: job.txId,
        userId: job.userId,
        serviceId: job.serviceId,
        serviceName: (service as { name?: string } | null)?.name || "Unknown Service",
        recipientNumber: job.recipientNumber,
        amount: job.amount,
        ussdSteps,
        simSlot: job.simSlot ?? 1,
        smsTimeout: job.smsTimeout ?? 30,
        successSmsFormat: job.successSmsFormat,
        failureSmsTemplates: job.failureSmsTemplates ?? [],
        status: job.status,
        locked: job.locked,
        lockedByDevice: job.lockedByDevice,
        attempt: job.attempt,
        createdAt: job.queuedAt ?? job.createdAt,
      },
    });
  } catch (err) {
    console.error("Job fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
