import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceProvider from "@/lib/db/models/ServiceProvider";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/providers/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    const { name, logo } = await request.json();
    await connectDB();
    const p = await ServiceProvider.findByIdAndUpdate(
      id,
      { name: name.trim(), logo: logo?.trim() || "" },
      { returnDocument: "after" }
    );
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "PROVIDER_UPDATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true });
  });
}

// DELETE /api/admin/providers/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    await connectDB();
    const p = await ServiceProvider.findByIdAndDelete(id);
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "PROVIDER_DELETED", entityId: id, severity: "warn" });
    return NextResponse.json({ success: true });
  });
}
