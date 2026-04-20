import connectDB from "@/lib/db/mongoose";
import SubscriptionCache from "@/lib/db/models/SubscriptionCache";

const SUBSCRIPTION_API =
  "https://drecharge.com/subscription/api/v1/check-domain";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = "subscription_cache";

export interface SubscriptionStatus {
  subscribed: boolean;
  expired: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  domain: string;
  checkedAt: string;
}

// Module-level in-memory cache (warm-function fast path)
let _memCache: { status: SubscriptionStatus; cachedAt: number } | null = null;

export function getSiteDomain(): string {
  const explicit = process.env.SITE_DOMAIN;
  if (explicit) return explicit.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      return new URL(siteUrl).hostname;
    } catch {}
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return vercelUrl;

  return "localhost";
}

function isDevDomain(domain: string): boolean {
  return (
    domain === "localhost" ||
    domain === "127.0.0.1" ||
    domain.endsWith(".local") ||
    domain.endsWith(".localhost") ||
    domain.includes("10.0.2.2")
  );
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
  const entry = json?.data?.domains?.[0];

  return {
    subscribed: entry?.subscribed === true && entry?.expired !== true,
    expired: entry?.expired === true,
    expiresAt: entry?.expiresAt ?? null,
    daysUntilExpiry: entry?.daysUntilExpiry ?? null,
    domain,
    checkedAt: json?.checkedAt ?? new Date().toISOString(),
  };
}

async function loadFromDb(): Promise<SubscriptionStatus | null> {
  try {
    await connectDB();
    const cached = await SubscriptionCache.findById(CACHE_KEY).lean();
    if (!cached) return null;
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return {
      subscribed: cached.subscribed,
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

export async function checkSubscription(): Promise<SubscriptionStatus> {
  const domain = getSiteDomain();
  const now = Date.now();

  // Dev / local → always subscribed
  if (isDevDomain(domain)) {
    return {
      subscribed: true,
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

  // 3. Fetch from external API
  try {
    const status = await fetchFromApi(domain);
    _memCache = { status, cachedAt: now };
    await saveToDb(status);
    return status;
  } catch (err) {
    console.error("[subscription] API fetch failed:", err);

    // Stale in-memory cache as last resort (don't block users on API downtime)
    if (_memCache) return _memCache.status;

    // API down + no cache → grace (subscribed: true)
    return {
      subscribed: true,
      expired: false,
      expiresAt: null,
      daysUntilExpiry: null,
      domain,
      checkedAt: new Date().toISOString(),
    };
  }
}
