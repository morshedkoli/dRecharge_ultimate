import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Notification from "@/lib/db/models/Notification";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin", "support_admin"];

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const isAdmin = ADMIN_ROLES.includes(session.role);
  const ownerQuery = isAdmin ? { recipientUid: "admin" } : { recipientUid: session.sub };

  await Notification.findOneAndUpdate(
    { _id: id, ...ownerQuery },
    { $set: { isRead: true } }
  );

  return NextResponse.json({ success: true });
}
