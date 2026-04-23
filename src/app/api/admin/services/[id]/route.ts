import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { getServiceTemplateUssdSteps, normalizeStructuredUssdSteps } from "@/lib/ussd";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/services/[id]
export async function GET(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async () => {
    const { id } = await params;
    await connectDB();
    const service = await Service.findById(id).lean();
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      service: {
        ...service,
        id: service._id,
        ussdSteps: getServiceTemplateUssdSteps(service as { ussdSteps?: unknown; ussdFlow?: unknown }),
      },
    });
  });
}

// PATCH /api/admin/services/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    const body = await request.json();
    const {
      name, icon, description, isActive, categoryId,
      ussdSteps, pin, simSlot, recipientLength, successSmsFormat,
      failureSmsTemplates, smsTimeout,
    } = body;

    await connectDB();
    const service = await Service.findByIdAndUpdate(
      id,
      {
        name,
        icon: icon || "",
        description: description || "",
        isActive: isActive !== false,
        categoryId: categoryId || null,
        ussdSteps: normalizeStructuredUssdSteps(ussdSteps),
        pin,
        simSlot,
        recipientLength,
        successSmsFormat,
        failureSmsTemplates: Array.isArray(failureSmsTemplates) ? failureSmsTemplates : [],
        smsTimeout,
        updatedBy: session.sub,
        updatedAt: new Date(),
      },
      { returnDocument: "after" }
    );
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "SERVICE_UPDATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true });
  });
}

// DELETE /api/admin/services/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    await connectDB();
    const service = await Service.findByIdAndDelete(id);
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "SERVICE_DELETED", entityId: id, severity: "warn", meta: { serviceId: id } });
    return NextResponse.json({ success: true });
  });
}
