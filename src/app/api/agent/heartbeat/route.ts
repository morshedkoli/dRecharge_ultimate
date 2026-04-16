import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import AgentDevice from "@/lib/db/models/AgentDevice";
import { extractAgentSession } from "../_auth";

// POST /api/agent/heartbeat
export async function POST(request: NextRequest) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const currentJob = String(body?.currentJob || "").trim();
    const simProvider = String(body?.simProvider || "").trim();
    const name = String(body?.name || "").trim();
    const appVersion = String(body?.appVersion || "").trim();

    await connectDB();

    const update: Record<string, unknown> = {
      lastHeartbeat: new Date(),
      status: currentJob ? "busy" : "online",
    };
    if (currentJob) update.currentJob = currentJob;
    else update.currentJob = null;
    if (simProvider) update.simProvider = simProvider;
    if (name) update.name = name;
    if (appVersion) update.appVersion = appVersion;

    await AgentDevice.findByIdAndUpdate(agentSession.deviceId, update);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Heartbeat error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
