import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Service from "@/lib/db/models/Service";
import { extractAgentSession } from "../_auth";
import { resolveJobUssdSteps } from "@/lib/ussd";
import { loadSuccessFormat, loadFailureTemplates } from "@/lib/sms-template";

// Stuck-job sweeper runs at most once per SWEEPER_INTERVAL_MS across all
// poll requests (module-level guard — survives within a single server
// process; serverless cold starts will rerun it, which is acceptable).
const SWEEPER_INTERVAL_MS = 60 * 1000;
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;
let lastSweeperRunAt = 0;

async function maybeRunStuckSweeper(): Promise<void> {
  const now = Date.now();
  if (now - lastSweeperRunAt < SWEEPER_INTERVAL_MS) return;
  lastSweeperRunAt = now;
  await ExecutionJob.updateMany(
    {
      status: "processing",
      locked: true,
      lockedAt: { $lt: new Date(now - STUCK_THRESHOLD_MS) },
    },
    {
      $set: { status: "queued", locked: false },
      $unset: { lockedAt: 1, lockedByDevice: 1 },
    }
  );
}

// GET /api/agent/queue — fetch next queued job
export async function GET(request: NextRequest) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    await maybeRunStuckSweeper();

    // Only dispatch jobs whose service is assigned to this device
    const assignedServices: string[] = agentSession.device.assignedServices ?? [];
    if (assignedServices.length === 0) {
      return NextResponse.json({ job: null });
    }

    const job = await ExecutionJob.findOne({
      status: "queued",
      locked: { $ne: true },
      serviceId: { $in: assignedServices },
    })
      .sort({ createdAt: 1 })
      .lean();

    if (!job) return NextResponse.json({ job: null });

    const service = await Service.findById(job.serviceId).lean();
    const serviceName =
      (service as { name?: string } | null)?.name ||
      (job as { serviceName?: string }).serviceName ||
      "Unknown Service";
    const ussdSteps = resolveJobUssdSteps({
      ...(service as { ussdSteps?: unknown; ussdFlow?: unknown; pin?: unknown } | null ?? {}),
      ussdSteps: job.ussdSteps,
      recipientNumber: job.recipientNumber,
      amount: job.amount,
    });

    // Resolve SMS templates with service fallback so agent always gets the format
    // even when the job was created before the template was configured on the service.
    const [successSmsFormat, failureSmsTemplates] = await Promise.all([
      loadSuccessFormat(job),
      loadFailureTemplates(job),
    ]);

    return NextResponse.json({
      job: {
        jobId: job._id,
        txId: job.txId,
        userId: job.userId,
        serviceId: job.serviceId,
        serviceName,
        recipientNumber: job.recipientNumber,
        amount: job.amount,
        ussdSteps,
        simSlot: job.simSlot ?? 1,
        smsTimeout: job.smsTimeout ?? 30,
        successSmsFormat,
        failureSmsTemplates,
        status: job.status,
        locked: job.locked,
        attempt: job.attempt,
        createdAt: job.queuedAt ?? job.createdAt,
      },
    });
  } catch (err) {
    console.error("Queue fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
