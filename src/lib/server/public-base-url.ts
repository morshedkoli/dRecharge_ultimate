import { NextRequest } from "next/server";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/** Rewrites localhost → 10.0.2.2 so Android emulators can reach the dev server. */
function toEmulatorReachableUrl(value: string) {
  const normalized = normalizeBaseUrl(value);
  try {
    const url = new URL(normalized);
    if (isLocalHost(url.hostname)) {
      url.hostname = "10.0.2.2";
      return normalizeBaseUrl(url.toString());
    }
    return normalizeBaseUrl(url.toString());
  } catch {
    return normalized;
  }
}

/**
 * Returns the actual URL of this server — shown in the admin panel.
 * Never rewrites localhost; uses the real origin so admins see the correct address.
 */
export function resolveAdminDisplayUrl(request: NextRequest): string {
  // Explicit env override always wins.
  const envUrl = process.env.AGENT_PUBLIC_BASE_URL;
  if (envUrl?.trim()) return normalizeBaseUrl(envUrl);

  // Reverse-proxy headers (Nginx, Vercel, Railway, Render, etc.)
  const proto = request.headers.get("x-forwarded-proto");
  const host  = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return normalizeBaseUrl(`${proto}://${host}`);

  // Direct origin from the request.
  const origin = request.nextUrl.origin;
  if (origin?.trim()) return normalizeBaseUrl(origin);

  return "http://localhost:3000";
}

/**
 * Returns the URL the Android agent should use to reach this server.
 * On local dev this rewrites localhost → 10.0.2.2 so emulators work;
 * on a real deployment it just returns the domain.
 * Used only by /api/agent/bootstrap so the agent stores the right URL.
 */
export function resolvePublicBaseUrl(request: NextRequest): string {
  const envUrl = process.env.AGENT_PUBLIC_BASE_URL;
  if (envUrl?.trim()) return normalizeBaseUrl(envUrl);

  const proto = request.headers.get("x-forwarded-proto");
  const host  = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return toEmulatorReachableUrl(`${proto}://${host}`);

  const origin = request.nextUrl.origin;
  if (origin?.trim()) return toEmulatorReachableUrl(origin);

  const fallbackEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fallbackEnv?.trim()) return toEmulatorReachableUrl(fallbackEnv);

  return "http://10.0.2.2:3000";
}
