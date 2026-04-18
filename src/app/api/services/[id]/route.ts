import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { getSession } from "@/lib/auth/session";
import { getServiceTemplateUssdSteps } from "@/lib/ussd";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await connectDB();
    const service = await Service.findById(id).lean();
    if (!service) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      service: {
        ...service,
        id: service._id,
        ussdSteps: getServiceTemplateUssdSteps(service as { ussdSteps?: unknown; ussdFlow?: unknown }),
      },
    });
  } catch (error) {
    console.error("Service fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
