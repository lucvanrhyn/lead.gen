import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getOperatorSessionFromCookieHeader } from "@/lib/auth/guards";

/**
 * Paths that are always public — no session or bearer token needed.
 * Keep this list minimal: login UI and auth API only.
 */
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/google-workspace/callback" ||
    pathname === "/api/google-workspace/gmail-watch/webhook"
  );
}

/**
 * Cron jobs hit /api/internal/* with a Bearer token instead of a cookie
 * session. Validate the token here so those routes are still protected.
 */
function hasCronSecret(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = getOperatorSessionFromCookieHeader(request.headers.get("cookie"));

  // Already authenticated: redirect away from login.
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  // Always-public paths need no further checks.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Internal cron routes are protected by a Bearer token, not a cookie.
  if (pathname.startsWith("/api/internal/")) {
    if (hasCronSecret(request)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requiresOperatorSession =
    pathname === "/" || pathname.startsWith("/leads") || pathname.startsWith("/api/");

  if (!requiresOperatorSession || session) {
    return NextResponse.next();
  }

  // API routes get a JSON 401; page routes get redirected to login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
