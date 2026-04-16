import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — allow through
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/dev")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("__session")?.value;

  // No session → redirect to login
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Verify JWT (Edge-compatible with jose)
  const payload = await verifySessionToken(sessionCookie);
  if (!payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Block non-admin users from /admin routes
  if (pathname.startsWith("/admin")) {
    const adminRoles = ["admin", "super_admin", "support_admin"];
    if (!adminRoles.includes(payload.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/user/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*"],
};
