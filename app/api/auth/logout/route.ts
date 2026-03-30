import { NextResponse } from "next/server";

import {
  getOperatorSessionCookieOptions,
  OPERATOR_SESSION_COOKIE,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(OPERATOR_SESSION_COOKIE, "", {
    ...getOperatorSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
