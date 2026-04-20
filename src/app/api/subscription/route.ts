import { NextRequest, NextResponse } from "next/server";
import { checkSubscription, invalidateSubscriptionCache, getSiteDomain } from "@/lib/subscription";
export const dynamic = "force-dynamic";

const EXTERNAL_API = "https://drecharge.com/subscription/api/v1/check-domain";

export type LicenseUiState = "active" | "expired" | "inactive" | "not_registered";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveUiState(data: any): LicenseUiState {
  if (!data || !data.tracked || data.status === "not_found") return "not_registered";
  if (data.tracked && data.expired) return "expired";
  if (data.tracked && data.subscribed && !data.expired) return "active";
  return "inactive";
}

// GET /api/subscription
// ?domain=foo.com  → direct proxy for LicenseCard (no cache)
// ?refresh=1       → bust cache for gate check
export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get("domain");

  // ── Direct proxy path (LicenseCard) ──────────────────────────────────────
  if (domainParam) {
    try {
      const url = `${EXTERNAL_API}/?domain=${encodeURIComponent(domainParam)}`;
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Upstream API error ${res.status}` },
          { status: 502 }
        );
      }
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = json?.data?.domain ? json.data : (json?.domain ? json : {});
      const checkedAt: string = json?.checkedAt ?? new Date().toISOString();
      return NextResponse.json({
        ...data,
        uiState: deriveUiState(data),
        checkedAt,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Network error" },
        { status: 502 }
      );
    }
  }

  // ── Gate path (admin panel) ───────────────────────────────────────────────
  try {
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    if (refresh) await invalidateSubscriptionCache();
    const status = await checkSubscription();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({
      state: "unknown",
      subscribed: true,
      tracked: false,
      expired: false,
      expiresAt: null,
      daysUntilExpiry: null,
      domain: getSiteDomain(),
      checkedAt: new Date().toISOString(),
    });
  }
}
