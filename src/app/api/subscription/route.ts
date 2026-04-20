import { NextResponse } from "next/server";
import { checkSubscription } from "@/lib/subscription";

// GET /api/subscription — returns current subscription status (cached)
export async function GET() {
  try {
    const status = await checkSubscription();
    return NextResponse.json(status);
  } catch {
    // Never crash — return subscribed on unexpected error
    return NextResponse.json({
      subscribed: true,
      expired: false,
      expiresAt: null,
      daysUntilExpiry: null,
      domain: "",
      checkedAt: new Date().toISOString(),
    });
  }
}
