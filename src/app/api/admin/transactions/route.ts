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
import { verifyPin } from "@/lib/auth/pin";
import { writeLedger } from "@/lib/wallet";
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
    const { serviceId, recipientNumber, amount: reqAmount, pin } = await request.json();
    const amount = Number(reqAmount || 0);
    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("Idempotency-Key") ||
      undefined;

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

    // Idempotency: if we've seen this key for this user, return the prior result.
    if (idempotencyKey) {
      const prior = await Transaction.findOne({ userId: uid, idempotencyKey }).lean();
      if (prior) {
        const priorJob = await ExecutionJob.findOne({ txId: prior._id }).lean();
        return NextResponse.json({
          success: true,
          txId: prior._id,
          jobId: priorJob?._id,
          idempotent: true,
        });
      }
    }

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
    let idempotentReplay: { txId: string; jobId?: string } | null = null;

    try {
      await dbSession.withTransaction(async () => {
        const user = await User.findById(uid).session(dbSession);
        if (!user || user.status !== "active") throw new Error("User not found or inactive");

        const submittedPin = String(pin || "");
        const pinOk = await verifyPin(submittedPin, user.pinHash);
        if (!pinOk) {
          throw new Error(user.pinHash ? "Invalid transaction PIN" : "Set a transaction PIN before creating transactions");
        }

        if (!isAdmin) {
          if (user.walletLocked) {
            throw new Error("Wallet is locked by another pending transaction");
          }
          const effectiveBalance = user.walletBalance + (user.creditLimit ?? 0);
          if (effectiveBalance < amount) {
            throw new Error(
              `Insufficient balance. Available: ৳${effectiveBalance.toFixed(2)} (balance ৳${user.walletBalance.toFixed(2)} + credit ৳${(user.creditLimit ?? 0).toFixed(2)})`
            );
          }

          // Deduct — balance may go negative (into credit territory)
          user.walletBalance = user.walletBalance - amount;
          user.walletLocked = true;
          await user.save({ session: dbSession });
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
          idempotencyKey,
          createdAt: new Date(),
        }], { session: dbSession });

        // Journal entry — non-admin path is the only one that mutates balance.
        if (!isAdmin) {
          await writeLedger({
            userId: uid,
            kind: "debit",
            amount: -amount,
            txId,
            jobId,
            actorUid: uid,
            session: dbSession,
            updateUserBalance: false,
          });
        }

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
    } catch (txErr) {
      // Race-loser path: another concurrent POST with the same Idempotency-Key
      // committed first, tripping the unique index. Treat as idempotent replay
      // rather than surfacing a 500. The withTransaction abort already rolled
      // back the partial debit on this request.
      const e = txErr as { code?: number; message?: string };
      const isDupKey =
        e?.code === 11000 ||
        (typeof e?.message === "string" && e.message.includes("E11000"));
      if (idempotencyKey && isDupKey) {
        const prior = await Transaction.findOne({ userId: uid, idempotencyKey }).lean();
        if (prior) {
          const priorJob = await ExecutionJob.findOne({ txId: prior._id }).lean();
          idempotentReplay = { txId: prior._id, jobId: priorJob?._id };
        } else {
          throw txErr;
        }
      } else {
        throw txErr;
      }
    } finally {
      await dbSession.endSession();
    }

    if (idempotentReplay) {
      return NextResponse.json({
        success: true,
        txId: idempotentReplay.txId,
        jobId: idempotentReplay.jobId,
        idempotent: true,
      });
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
