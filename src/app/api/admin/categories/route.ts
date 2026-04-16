import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceCategory from "@/lib/db/models/ServiceCategory";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { nanoid } from "nanoid";

// GET /api/admin/categories
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const categories = await ServiceCategory.find().sort({ order: 1, name: 1 }).lean();
    const mapped = categories.map(c => ({ ...c, id: c._id }));
    return NextResponse.json({ categories: mapped });
  });
}

// POST /api/admin/categories
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { name, logo } = await request.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    await connectDB();
    const id = nanoid(20);
    await ServiceCategory.create({ _id: id, name: name.trim(), logo: logo?.trim() || "" });
    await writeLog({ uid: session.sub, action: "CATEGORY_CREATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true, categoryId: id });
  });
}
