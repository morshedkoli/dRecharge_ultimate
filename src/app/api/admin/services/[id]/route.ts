import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

/** Derive the legacy hyphen-delimited USSD flow string from structured steps */
function deriveUssdFlow(steps: { type: string; value: string }[]): string {
  return steps
    .filter((s) => s.type !== "wait") // wait steps have no dial value
    .map((s) => s.value)
    .join("-");
}

// GET /api/admin/services/[id]
export async function GET(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async () => {
    const { id } = await params;
    await connectDB();
    const service = await Service.findById(id).lean();
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ service: { ...service, id: service._id } });
  });
}

// PATCH /api/admin/services/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    const body = await request.json();
    const {
      name, icon, description, isActive, categoryId,
      ussdSteps, pin, simSlot, successSmsFormat,
      failureSmsFormat, failureSmsTemplates, smsTimeout,
    } = body;

    // Auto-derive legacy ussdFlow string from structured steps
    const derivedUssdFlow =
      Array.isArray(ussdSteps) && ussdSteps.length > 0
        ? deriveUssdFlow(ussdSteps)
        : (body.ussdFlow ?? "");

    await connectDB();
    const service = await Service.findByIdAndUpdate(
      id,
      {
        name,
        icon: icon || "",
        description: description || "",
        isActive: isActive !== false,
        categoryId: categoryId || null,
        ussdFlow: derivedUssdFlow,
        ussdSteps: Array.isArray(ussdSteps)
          ? ussdSteps.map((s, i) => ({ ...s, order: i + 1 }))
          : [],
        pin,
        simSlot,
        successSmsFormat,
        // Keep legacy single format for old agent fallback (first template's pattern)
        failureSmsFormat: Array.isArray(failureSmsTemplates) && failureSmsTemplates.length > 0
          ? failureSmsTemplates[0].template
          : (failureSmsFormat ?? ""),
        failureSmsTemplates: Array.isArray(failureSmsTemplates) ? failureSmsTemplates : [],
        smsTimeout,
        updatedBy: session.sub,
        updatedAt: new Date(),
      },
      { new: true }
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
