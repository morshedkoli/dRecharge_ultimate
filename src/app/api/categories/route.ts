import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ServiceCategory from "@/lib/db/models/ServiceCategory";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const categories = await ServiceCategory.find().sort({ order: 1, name: 1 }).lean();
    const mapped = categories.map((category) => ({ ...category, id: category._id }));
    return NextResponse.json({ categories: mapped });
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
