import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ExecutionJob from "@/lib/db/models/ExecutionJob";
import Service from "@/lib/db/models/Service";
import { getSession } from "@/lib/auth/session";

// GET /api/user/manual-jobs
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  
  // We don't have canManuallyCompleteJobs in the JWT session, 
  // so we should fetch the user to check permissions, or just let it pass 
  // and the UI only shows this route if allowed. For security, let's check:
  const User = (await import("@/lib/db/models/User")).default;
  const user = await User.findById(session.sub).lean();
  if (!user?.canManuallyCompleteJobs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find jobs that are queued and either not locked by ANYONE, or locked by ME
  const jobs = await ExecutionJob.find({
    status: "queued",
    $or: [
      { locked: { $ne: true } },
      { lockedByUser: session.sub }
    ]
  })
    .sort({ queuedAt: 1, createdAt: 1 })
    .lean();

  const serviceIds = [...new Set(jobs.map((j) => j.serviceId))];
  const services = await Service.find({ _id: { $in: serviceIds } }).lean();
  const serviceMap = new Map(services.map((s) => [s._id, s]));

  const mappedJobs = jobs.map((raw) => {
    const srv = serviceMap.get(raw.serviceId);
    const isClaimedByMe = raw.locked === true && raw.lockedByUser === session.sub;
    
    return {
      jobId: raw._id,
      txId: raw.txId,
      serviceId: raw.serviceId,
      serviceName: srv?.name || raw.serviceId,
      serviceIcon: srv?.icon || null,
      amount: raw.amount,
      // Mask recipient if not claimed by me
      recipientNumber: isClaimedByMe ? raw.recipientNumber : "Hidden until claimed",
      status: raw.status,
      isClaimedByMe,
      queuedAt: raw.queuedAt || raw.createdAt,
    };
  });

  return NextResponse.json({ jobs: mappedJobs });
}
