import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import SmsMessage from "@/lib/db/models/SmsMessage";
import { withAdminSession } from "@/lib/auth/session";

/**
 * GET /api/admin/sms
 *
 * Query params:
 *   limit    – max results  (default 100, max 500)
 *   page     – 0-indexed page (default 0)
 *   deviceId – filter by agent device
 *   search   – partial-match on sender / body
 *   unread   – "true" to return only unread messages
 */
export async function GET(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit    = Math.min(parseInt(searchParams.get("limit")  || "100"), 500);
    const page     = Math.max(parseInt(searchParams.get("page")   || "0"),   0);
    const deviceId = searchParams.get("deviceId");
    const search   = searchParams.get("search");
    const unread   = searchParams.get("unread") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (deviceId) filter.deviceId = deviceId;
    if (unread)   filter.isRead   = false;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ sender: re }, { body: re }];
    }

    const [messages, total, unreadCount] = await Promise.all([
      SmsMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      SmsMessage.countDocuments(filter),
      SmsMessage.countDocuments({ isRead: false }),
    ]);

    const mapped = messages.map((m) => ({
      id:         m._id,
      deviceId:   m.deviceId,
      deviceName: m.deviceName ?? "",
      sender:     m.sender,
      body:       m.body,
      receivedAt: m.receivedAt,
      createdAt:  m.createdAt,
      isRead:     m.isRead,
    }));

    return NextResponse.json({ messages: mapped, total, unreadCount });
  });
}

/**
 * PATCH /api/admin/sms
 *
 * Mark messages as read.
 * Body: { ids: string[] }  OR  { all: true }
 */
export async function PATCH(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();

    const body = await request.json().catch(() => ({})) as {
      ids?: string[];
      all?: boolean;
    };

    if (body.all) {
      await SmsMessage.updateMany({}, { $set: { isRead: true } });
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await SmsMessage.updateMany(
        { _id: { $in: body.ids } },
        { $set: { isRead: true } }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Provide ids[] or all:true" }, { status: 400 });
  });
}

/**
 * DELETE /api/admin/sms
 *
 * Delete messages.
 * Body: { ids: string[] }  OR  { all: true }
 */
export async function DELETE(request: NextRequest) {
  return withAdminSession(request, async () => {
    await connectDB();

    const body = await request.json().catch(() => ({})) as {
      ids?: string[];
      all?: boolean;
    };

    if (body.all) {
      await SmsMessage.deleteMany({});
      return NextResponse.json({ ok: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await SmsMessage.deleteMany({ _id: { $in: body.ids } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Provide ids[] or all:true" }, { status: 400 });
  });
}
