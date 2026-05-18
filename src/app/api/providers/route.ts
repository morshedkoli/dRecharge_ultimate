import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceProvider from "@/lib/db/models/ServiceProvider";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const providers = await ServiceProvider.find().sort({ order: 1, name: 1 }).lean();
    const mapped = providers.map((p) => ({ ...p, id: p._id }));
    return NextResponse.json({ providers: mapped });
  } catch (error) {
    console.error("Providers fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
