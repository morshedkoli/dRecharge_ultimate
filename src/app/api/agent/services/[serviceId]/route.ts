import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { extractAgentSession } from "../../_auth";

type Params = { params: Promise<{ serviceId: string }> };

// GET /api/agent/services/[serviceId]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const agentSession = await extractAgentSession(request);
    if (!agentSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { serviceId } = await params;
    await connectDB();
    const service = await Service.findById(serviceId).lean();

    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      service: {
        id: service._id,
        name: service.name,
        ussdSteps: service.ussdSteps ?? [],
        pin: service.pin,
        simSlot: service.simSlot,
        smsTimeout: service.smsTimeout,
        successSmsFormat: service.successSmsFormat,
        failureSmsTemplates: service.failureSmsTemplates ?? [],
        isActive: service.isActive,
      },
    });
  } catch (err) {
    console.error("Service fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
