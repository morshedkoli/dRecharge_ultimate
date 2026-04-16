import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { nanoid } from "nanoid";

// GET /api/admin/services
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const services = await Service.find().sort({ name: 1 }).lean();
    const mapped = services.map(s => ({ ...s, id: s._id }));
    return NextResponse.json({ services: mapped });
  });
}

// POST /api/admin/services — create service
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const body = await request.json();
    const { name, icon, description, isActive, categoryId, ussdFlow, pin, simSlot, successSmsFormat, failureSmsFormat, smsTimeout } = body;

    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    await connectDB();
    const id = nanoid(20);
    await Service.create({
      _id: id,
      name,
      icon: icon || "",
      description: description || "",
      isActive: isActive !== false,
      categoryId: categoryId || null,
      ussdFlow: ussdFlow || "",
      pin: pin || "",
      simSlot: simSlot || 1,
      successSmsFormat: successSmsFormat || "",
      failureSmsFormat: failureSmsFormat || "",
      smsTimeout: smsTimeout || 30,
      updatedBy: session.sub,
    });

    await writeLog({ uid: session.sub, action: "SERVICE_CREATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true, serviceId: id });
  });
}
