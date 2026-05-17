import { NextRequest } from "next/server";
import { verifySessionToken, SessionPayload } from "./jwt";
import connectDB from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

export async function getSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get("__session")?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(
  request: NextRequest
): Promise<SessionPayload> {
  const session = await getSession(request);
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export function requireAdmin(session: SessionPayload): void {
  const adminRoles = ["admin", "super_admin", "support_admin"];
  if (!adminRoles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
}

async function getCurrentActiveSession(request: NextRequest): Promise<SessionPayload | null> {
  const session = await getSession(request);
  if (!session) return null;

  await connectDB();
  const user = await User.findById(session.sub).select("role status displayName email username").lean();
  if (!user || user.status !== "active") return null;

  return {
    sub: user._id,
    email: user.email || user.username || session.email,
    role: user.role,
    displayName: user.displayName,
  };
}

export function apiError(message: string, status: number) {
  const { NextResponse } = require("next/server");
  return NextResponse.json({ error: message }, { status });
}

export async function withAdminSession(
  request: NextRequest,
  handler: (session: SessionPayload) => Promise<Response>
): Promise<Response> {
  const { NextResponse } = require("next/server");
  try {
    const session = await getCurrentActiveSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    requireAdmin(session);
    return await handler(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function withUserSession(
  request: NextRequest,
  handler: (session: SessionPayload) => Promise<Response>
): Promise<Response> {
  const { NextResponse } = require("next/server");
  try {
    const session = await getCurrentActiveSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return await handler(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// forced-update
