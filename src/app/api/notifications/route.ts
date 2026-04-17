import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import Notification from "@/lib/db/models/Notification";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin", "support_admin"];

// GET /api/notifications — fetch notifications for the current session
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const isAdmin = ADMIN_ROLES.includes(session.role);

  // Admins see broadcasts; users see their own
  const query = isAdmin
    ? { recipientUid: "admin" }
    : { recipientUid: session.sub };

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({ ...n, id: n._id })),
    unreadCount,
  });
}

// PATCH /api/notifications — mark all as read
export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const isAdmin = ADMIN_ROLES.includes(session.role);
  const query = isAdmin ? { recipientUid: "admin" } : { recipientUid: session.sub };

  await Notification.updateMany({ ...query, isRead: false }, { $set: { isRead: true } });

  return NextResponse.json({ success: true });
}
