import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { extractAgentSession } from "../../../_auth";

type Params = { params: Promise<{ jobId: string }> };

// POST /api/agent/queue/[jobId]/lock — acquire job lock atomically
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    await connectDB();

    // Atomic: only lock if not already locked and status is queued
    const job = await ExecutionJob.findOneAndUpdate(
      { _id: jobId, locked: false, status: "queued" },
      {
        locked: true,
        lockedAt: new Date(),
        lockedByDevice: agentSession.deviceId,
        status: "processing",
      },
      { new: true }
    );

    if (!job) {
      return NextResponse.json({ acquired: false });
    }

    // Update device status
    await AgentDevice.findByIdAndUpdate(agentSession.deviceId, {
      currentJob: jobId,
      lastHeartbeat: new Date(),
      status: "busy",
    });

    return NextResponse.json({ acquired: true });
  } catch (err) {
    console.error("Lock error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
