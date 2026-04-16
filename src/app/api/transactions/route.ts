import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Transaction from "@/lib/db/models/Transaction";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const transactions = await Transaction.find({ userId: session.sub })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      transactions: transactions.map((tx) => ({ id: tx._id, ...tx })),
    });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
