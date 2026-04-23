import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Transaction from "@/lib/db/models/Transaction";
import BalanceRequest from "@/lib/db/models/BalanceRequest";
import { withAdminSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    
    await connectDB();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 1. Transaction Summaries
    const txSummaryAgg = await Transaction.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const txStats: Record<string, { count: number; amount: number }> = {
      send: { count: 0, amount: 0 },
      topup: { count: 0, amount: 0 },
      credit: { count: 0, amount: 0 },
      deduct: { count: 0, amount: 0 },
      refund: { count: 0, amount: 0 },
    };

    txSummaryAgg.forEach(st => {
      if (txStats[st._id]) {
        txStats[st._id] = { count: st.count, amount: st.amount || 0 };
      }
    });

    const addBalance = {
      count: txStats.topup.count + txStats.credit.count,
      amount: txStats.topup.amount + txStats.credit.amount
    };
    const deductBalance = {
      count: txStats.deduct.count,
      amount: txStats.deduct.amount
    };
    const totalTransactions = {
      count: txStats.send.count,
      amount: txStats.send.amount
    };

    // 2. Balance Request Summaries
    const reqSummaryAgg = await BalanceRequest.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const requestBalance = {
      count: reqSummaryAgg[0]?.count || 0,
      amount: reqSummaryAgg[0]?.amount || 0
    };

    const summary = {
      addBalance,
      deductBalance,
      requestBalance,
      totalTransactions
    };

    // 3. Daily Volume & Execution Health (from ExecutionJob)
    const jobsAgg = await ExecutionJob.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
          },
          totalVolume: {
            $sum: { $cond: [{ $eq: ["$status", "done"] }, "$amount", 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const dailyData = jobsAgg.map(job => ({
      date: job._id,
      successCount: job.successCount,
      failedCount: job.failedCount,
      totalVolume: job.totalVolume
    }));

    // 4. Service Usage (from ExecutionJob)
    const serviceAgg = await ExecutionJob.aggregate([
      {
        $group: {
          _id: "$serviceId",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const serviceData = serviceAgg.map(s => ({
      serviceId: s._id || "unknown",
      count: s.count
    }));

    return NextResponse.json({
      summary,
      dailyData,
      serviceData
    });
  });
}
