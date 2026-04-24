import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import SmsMessage from "@/lib/db/models/SmsMessage";
import { extractAgentSession } from "../_auth";
import { nanoid } from "nanoid";

/**
 * POST /api/agent/sms
 *
 * Called by the Android agent app to push received SMS messages to the server.
 *
 * Body (JSON):
 *   messages: Array<{
 *     sender: string;
 *     body: string;
 *     receivedAt: number;  // Unix ms timestamp
 *   }>
 *
 * Auth: Agent JWT in Authorization header.
 */
export async function POST(request: NextRequest) {
  const session = await extractAgentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deviceId, device } = session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages } = body as {
    messages?: Array<{ sender: string; body: string; receivedAt: number }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Limit batch size to prevent abuse
  const batch = messages.slice(0, 200);

  await connectDB();

  const docs = batch.map((msg) => ({
    _id: nanoid(),
    deviceId,
    deviceName: (device as { name?: string }).name ?? "",
    sender: String(msg.sender ?? "").trim(),
    body: String(msg.body ?? "").trim(),
    receivedAt: new Date(typeof msg.receivedAt === "number" ? msg.receivedAt : Date.now()),
    isRead: false,
  }));

  await SmsMessage.insertMany(docs, { ordered: false });

  return NextResponse.json({ saved: docs.length });
}
