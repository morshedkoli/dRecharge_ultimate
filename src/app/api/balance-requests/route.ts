import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import BalanceRequest from "@/lib/db/models/BalanceRequest";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const requests = await BalanceRequest.find({ userId: session.sub })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      requests: requests.map((req) => ({ id: req._id, ...req })),
    });
  } catch (error) {
    console.error("Balance requests fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
