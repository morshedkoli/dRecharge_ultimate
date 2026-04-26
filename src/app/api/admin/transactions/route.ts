import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Transaction from "@/lib/db/models/Transaction";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import User from "@/lib/db/models/User";
import Service from "@/lib/db/models/Service";
import { writeLog } from "@/lib/db/audit";
import { getSession } from "@/lib/auth/session";
import { withAdminSession } from "@/lib/auth/session";
import { resolveJobUssdSteps } from "@/lib/ussd";
import { checkSubscription } from "@/lib/subscription";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

// GET /api/admin/transactions
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({ transactions });
  });
}

// POST /api/admin/transactions — user-initiated transaction
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sub = await checkSubscription();
    if (!sub.subscribed) {
      return NextResponse.json(
        { error: "Subscription expired. Renew at drecharge.com to create transactions." },
        { status: 403 }
      );
    }

    const isAdmin = ["admin", "super_admin", "support_admin"].includes(session.role);
    const { serviceId, recipientNumber, amount: reqAmount } = await request.json();
    const amount = reqAmount || 0;

    if (isAdmin) {
      if (!serviceId || !recipientNumber) {
        return NextResponse.json({ error: "serviceId, recipientNumber required" }, { status: 400 });
      }
    } else {
      if (!serviceId || !recipientNumber || !amount || amount <= 0) {
        return NextResponse.json({ error: "serviceId, recipientNumber, amount required" }, { status: 400 });
      }
    }

    const uid = session.sub;
    await connectDB();

    const service = await Service.findById(serviceId).lean();
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    if (!service.isActive) return NextResponse.json({ error: "Service is currently inactive" }, { status: 400 });

    const requiredRecipientLength = service.recipientLength || 11;
    if (recipientNumber.length !== requiredRecipientLength) {
      return NextResponse.json({ error: `Recipient number must be exactly ${requiredRecipientLength} digits` }, { status: 400 });
    }

    const dbSession = await mongoose.startSession();
    let txId = "";
    let jobId = "";

    try {
      await dbSession.withTransaction(async () => {
        if (!isAdmin) {
          const user = await User.findOneAndUpdate(
            { _id: uid, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
            { returnDocument: "after", session: dbSession },
          );
          if (!user) {
            const existingUser = await User.findById(uid).session(dbSession);
            if (!existingUser) throw new Error("User not found");
            throw new Error("Insufficient balance");
          }
        }

        txId = "TX_" + nanoid(20);
        jobId = "JOB_" + nanoid(20);

        const resolvedSteps = resolveJobUssdSteps({
          ...(service as { ussdSteps?: unknown; ussdFlow?: unknown; pin?: unknown }),
          recipientNumber,
          amount,
        });

        await Transaction.create([{
          _id: txId,
          userId: uid,
          type: "send",
          serviceId,
          recipientNumber,
          amount,
          fee: 0,
          status: "pending",
          createdAt: new Date(),
        }], { session: dbSession });

        await ExecutionJob.create([{
          _id: jobId,
          txId,
          userId: uid,
          serviceId,
          serviceName: service.name || serviceId,
          recipientNumber,
          amount,
          ussdSteps: resolvedSteps,
          simSlot: service.simSlot ?? 1,
          smsTimeout: service.smsTimeout ?? 30,
          successSmsFormat: service.successSmsFormat || "",
          failureSmsTemplates: service.failureSmsTemplates || [],
          status: "queued",
          locked: false,
          attempt: 0,
          createdAt: new Date(),
        }], { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid,
      action: "TX_INITIATED",
      entityId: txId,
      meta: {
        serviceId,
        serviceName: service.name || serviceId,
        recipientNumber,
        amount,
      },
    });
    return NextResponse.json({ success: true, txId, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
