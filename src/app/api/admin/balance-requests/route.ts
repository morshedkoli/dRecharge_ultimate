import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import BalanceRequest from "@/lib/db/models/BalanceRequest";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";
import { nanoid } from "nanoid";
import mongoose from "mongoose";

// GET /api/admin/balance-requests
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const requests = await BalanceRequest.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({ requests });
  });
}

// POST /api/admin/balance-requests — user submits a request
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount, medium, note } = await request.json();
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Positive amount required" }, { status: 400 });
    }

    await connectDB();
    const reqId = nanoid(20);
    await BalanceRequest.create({
      _id: reqId,
      userId: session.sub,
      amount,
      medium: medium || "",
      note: note || "",
      status: "pending",
      createdAt: new Date(),
    });

    await writeLog({ uid: session.sub, action: "BALANCE_REQUEST_CREATED", entityId: reqId, meta: { amount, medium, note } });
    return NextResponse.json({ success: true, requestId: reqId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
