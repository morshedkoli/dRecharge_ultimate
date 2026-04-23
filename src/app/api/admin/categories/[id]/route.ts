import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceCategory from "@/lib/db/models/ServiceCategory";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/categories/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    const { name, logo } = await request.json();
    await connectDB();
    const cat = await ServiceCategory.findByIdAndUpdate(
      id,
      { name: name.trim(), logo: logo?.trim() || "" },
      { returnDocument: "after" }
    );
    if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "CATEGORY_UPDATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true });
  });
}

// DELETE /api/admin/categories/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  return withAdminSession(request, async (session) => {
    const { id } = await params;
    await connectDB();
    const cat = await ServiceCategory.findByIdAndDelete(id);
    if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeLog({ uid: session.sub, action: "CATEGORY_DELETED", entityId: id, severity: "warn" });
    return NextResponse.json({ success: true });
  });
}
