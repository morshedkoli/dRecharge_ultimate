import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { getSession } from "@/lib/auth/session";
import { getServiceTemplateUssdSteps } from "@/lib/ussd";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";

    await connectDB();
    const services = await Service.find(includeInactive ? {} : { isActive: true })
      .sort({ name: 1 })
      .lean();
    const mapped = services.map((service) => ({
      ...service,
      id: service._id,
      ussdSteps: getServiceTemplateUssdSteps(service as { ussdSteps?: unknown; ussdFlow?: unknown }),
    }));
    return NextResponse.json({ services: mapped });
  } catch (error) {
    console.error("Services fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
