import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getOperatorSessionFromCookieHeader } from "@/lib/auth/guards";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/google-workspace/gmail-watch/webhook"
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = getOperatorSessionFromCookieHeader(request.headers.get("cookie"));

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const requiresOperatorSession =
    pathname === "/" || pathname.startsWith("/leads") || pathname.startsWith("/api/");

  if (!requiresOperatorSession || session) {
    return NextResponse.next();
  }

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
