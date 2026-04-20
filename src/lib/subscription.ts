import connectDB from "@/lib/db/mongoose";
import SubscriptionCache from "@/lib/db/models/SubscriptionCache";

const SUBSCRIPTION_API =
  "https://drecharge.com/subscription/api/v1/check-domain";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = "subscription_cache";

/**
 * Possible subscription states, derived from all API fields combined:
 *
 * "active"    — tracked=true, subscribed=true, expired=false, status="subscribed"
 * "expired"   — tracked=true, was subscribed, expired=true
 * "inactive"  — tracked=true, subscribed=false (cancelled / never purchased)
 * "untracked" — tracked=false (domain not registered in system)
 * "unknown"   — API unreachable, no cache available (grace: treated as active)
 */
export type SubscriptionState =
  | "active"
  | "expired"
  | "inactive"
  | "untracked"
  | "unknown";

export interface SubscriptionStatus {
  /** Derived state — primary field for all logic. */
  state: SubscriptionState;
  /** True only when state === "active". Use this for gate checks. */
  subscribed: boolean;
  /** True when domain is tracked in the system. */
  tracked: boolean;
  /** True when a subscription existed but has lapsed. */
  expired: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  domain: string;
  checkedAt: string;
}

// Module-level in-memory cache (warm-function fast path in serverless)
let _memCache: { status: SubscriptionStatus; cachedAt: number } | null = null;

export function getSiteDomain(): string {
  const explicit = process.env.SITE_DOMAIN;
  if (explicit) return explicit.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try { return new URL(siteUrl).hostname; } catch {}
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return vercelUrl;

  return "localhost";
}

function isDevDomain(domain: string): boolean {
  return (
    domain === "localhost" ||
    domain === "127.0.0.1" ||
    domain.startsWith("192.168.") ||
    domain.endsWith(".local") ||
    domain.endsWith(".localhost") ||
    domain.includes("10.0.2.2") ||
    domain.includes("vercel.app") // preview deployments
  );
}

/**
 * Derives a SubscriptionState from all four API fields.
 * ALL must be satisfied for "active":
 *   tracked=true, subscribed=true, expired=false, status="subscribed"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveState(entry: any): SubscriptionState {
  if (!entry) return "untracked";

  const tracked    = entry.tracked    === true;
  const subscribed = entry.subscribed === true;
  const expired    = entry.expired    === true;
  const status     = String(entry.status ?? "").toLowerCase().trim();

  if (!tracked) return "untracked";
  if (expired)  return "expired";
  if (subscribed && status === "subscribed") return "active";
  return "inactive"; // tracked but not subscribed (cancelled / pending)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStatus(domain: string, entry: any, checkedAt: string): SubscriptionStatus {
  const state = deriveState(entry);
  const rawDays = entry?.daysUntilExpiry;
  return {
    state,
    subscribed: state === "active",
    tracked: entry?.tracked === true,
    expired: entry?.expired === true,
    expiresAt: entry?.expiresAt ?? null,
    // negative = already expired by N days; null = unknown
    daysUntilExpiry: typeof rawDays === "number" ? rawDays : null,
    domain: entry?.domain ?? domain,
    checkedAt,
  };
}

async function fetchFromApi(domain: string): Promise<SubscriptionStatus> {
  const res = await fetch(SUBSCRIPTION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains: [domain] }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Subscription API HTTP ${res.status}`);

  const json = await res.json();
  if (!json?.success) throw new Error("Subscription API returned success=false");

  // API returns domain data in json.data (single object) and duplicated at top level.
  // If neither exists, treat as untracked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry: any = json?.data ?? (json?.domain ? json : null);

  const checkedAt: string = json?.checkedAt ?? new Date().toISOString();
  return buildStatus(domain, entry, checkedAt);
}

async function loadFromDb(): Promise<SubscriptionStatus | null> {
  try {
    await connectDB();
    const cached = await SubscriptionCache.findById(CACHE_KEY).lean();
    if (!cached) return null;
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return {
      state: (cached.state as SubscriptionState) ?? "unknown",
      subscribed: cached.subscribed,
      tracked: cached.tracked ?? false,
      expired: cached.expired,
      expiresAt: cached.expiresAt,
      daysUntilExpiry: cached.daysUntilExpiry,
      domain: cached.domain,
      checkedAt: cached.checkedAt,
    };
  } catch {
    return null;
  }
}

async function saveToDb(status: SubscriptionStatus): Promise<void> {
  try {
    await connectDB();
    await SubscriptionCache.findByIdAndUpdate(
      CACHE_KEY,
      { ...status, _id: CACHE_KEY, cachedAt: new Date() },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[subscription] DB cache write failed:", err);
  }
}

/** Clears both caches — call after a known renewal to force fresh check. */
export async function invalidateSubscriptionCache(): Promise<void> {
  _memCache = null;
  try {
    await connectDB();
    await SubscriptionCache.deleteOne({ _id: CACHE_KEY });
  } catch {}
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  const domain = getSiteDomain();
  const now = Date.now();

  // Dev / local / preview → always active (skip external check)
  if (isDevDomain(domain)) {
    return {
      state: "active",
      subscribed: true,
      tracked: true,
      expired: false,
      expiresAt: null,
      daysUntilExpiry: null,
      domain,
      checkedAt: new Date().toISOString(),
    };
  }

  // 1. In-memory cache (warm serverless instance)
  if (_memCache && now - _memCache.cachedAt < CACHE_TTL_MS) {
    return _memCache.status;
  }

  // 2. DB cache (cold serverless instance)
  const dbCached = await loadFromDb();
  if (dbCached) {
    _memCache = { status: dbCached, cachedAt: now };
    return dbCached;
  }

  // 3. Live fetch from external API
  try {
    const status = await fetchFromApi(domain);
    _memCache = { status, cachedAt: now };
    await saveToDb(status);
    return status;
  } catch (err) {
    console.error("[subscription] API fetch failed:", err);

    // Stale memory cache → use it (don't block users on transient API downtime)
    if (_memCache) return _memCache.status;

    // Nothing at all → "unknown" grace state (treated as active)
    return {
      state: "unknown",
      subscribed: true,
      tracked: false,
      expired: false,
      expiresAt: null,
      daysUntilExpiry: null,
      domain,
      checkedAt: new Date().toISOString(),
    };
  }
}
