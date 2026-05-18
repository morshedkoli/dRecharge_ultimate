import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceProvider from "@/lib/db/models/ServiceProvider";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { nanoid } from "nanoid";

// GET /api/admin/providers
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const providers = await ServiceProvider.find().sort({ order: 1, name: 1 }).lean();
    const mapped = providers.map((p) => ({ ...p, id: p._id }));
    return NextResponse.json({ providers: mapped });
  });
}

// POST /api/admin/providers
export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { name, logo } = await request.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    await connectDB();
    const id = nanoid(20);
    await ServiceProvider.create({ _id: id, name: name.trim(), logo: logo?.trim() || "" });
    await writeLog({ uid: session.sub, action: "PROVIDER_CREATED", entityId: id, meta: { name } });
    return NextResponse.json({ success: true, providerId: id });
  });
}
