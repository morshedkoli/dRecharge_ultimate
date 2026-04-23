import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import { writeLog } from "@/lib/db/audit";
import { withAdminSession } from "@/lib/auth/session";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    const { jobIds } = await request.json();

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: "Invalid jobIds array" }, { status: 400 });
    }

    await connectDB();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        // Find all jobs that are waiting, failed or cancelled among the given IDs
        const jobs = await ExecutionJob.find({
          _id: { $in: jobIds },
          status: { $in: ["waiting", "failed", "cancelled"] }
        }).session(dbSession);

        if (jobs.length === 0) {
            throw new Error("No eligible jobs found for resend.");
        }

        const validJobIds = jobs.map(j => j._id);

        // Update all valid jobs back to queued state
        await ExecutionJob.updateMany(
          { _id: { $in: validJobIds } },
          { 
            $set: { 
                status: "queued", 
                locked: false, 
                attempts: 0 
            },
            $unset: { 
                lockedByDevice: "", 
                lockedAt: "", 
                simSlot: "" 
            }
          },
          { session: dbSession }
        );
      });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    } finally {
      await dbSession.endSession();
    }

    await writeLog({
      uid: session.sub,
      action: "JOB_RESENT_BULK",
      entityId: "bulk",
      severity: "info",
      meta: { reason: `Admin manually resent ${jobIds.length} jobs to queue`, jobIds },
    });

    return NextResponse.json({ success: true });
  });
}
