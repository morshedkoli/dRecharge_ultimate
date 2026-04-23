import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import User from "@/lib/db/models/User";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

import Service from "@/lib/db/models/Service";

// GET /api/admin/history
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "all";

    await connectDB();

    // Calculate global stats using aggregation
    const statsAggr = await ExecutionJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      }
    ]);
    
    const stats: Record<string, { count: number; amount: number }> = {
      all: { count: 0, amount: 0 },
      queued: { count: 0, amount: 0 },
      processing: { count: 0, amount: 0 },
      waiting: { count: 0, amount: 0 },
      done: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 }
    };
    
    statsAggr.forEach((st) => {
      stats[st._id] = { count: st.count, amount: st.amount || 0 };
      stats.all.count += st.count;
      stats.all.amount += (st.amount || 0);
    });

    const query: any = {};
    if (status !== "all") {
      query.status = status;
    }

    const total = await ExecutionJob.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    const raw = await ExecutionJob.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // Fetch services to attach names and logos
    const services = await Service.find().select("name icon").lean();
    const serviceMap = services.reduce((acc, s) => {
      acc[s._id as string] = { name: s.name, icon: s.icon };
      return acc;
    }, {} as Record<string, { name: string; icon?: string }>);

    // Map _id → jobId so the frontend type matches, and inject service info
    const jobs = raw.map((j) => ({ 
      ...j, 
      jobId: j._id,
      serviceName: serviceMap[j.serviceId]?.name || j.serviceId,
      serviceIcon: serviceMap[j.serviceId]?.icon || null,
    }));
    
    return NextResponse.json({ 
      jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      stats
    });
  });
}

// PATCH /api/admin/history — fail a job manually
export async function PATCH(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { jobId, txId, reason } = await request.json();
    if (!jobId || !txId) {
      return NextResponse.json({ error: "jobId and txId required" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const job = await ExecutionJob.findById(jobId).session(dbSession);
        const tx = await Transaction.findById(txId).session(dbSession);
        if (!job || !tx) throw new Error("Job or transaction not found");

        job.status = "failed";
        job.locked = false;
        job.parsedResult = { success: false, reason: reason || "Admin force-failed" };
        job.completedAt = new Date();
        await job.save({ session: dbSession });

        tx.status = "failed";
        if (reason) (tx as any).failureReason = reason;
        tx.completedAt = new Date();
        await tx.save({ session: dbSession });

        await User.findByIdAndUpdate(
          tx.userId,
          { $inc: { walletBalance: tx.amount }, walletLocked: false },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({ uid: session.sub, action: "TX_FAILED", entityId: txId, severity: "warn", meta: { reason, jobId } });
    return NextResponse.json({ success: true });
  });
}
