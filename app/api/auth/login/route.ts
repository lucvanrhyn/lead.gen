import { NextResponse } from "next/server";

import {
  createOperatorSessionToken,
  getOperatorSessionCookieOptions,
  OPERATOR_SESSION_COOKIE,
  hasValidOperatorCredentials,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!hasValidOperatorCredentials(email, password)) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const response = NextResponse.redirect(new URL("/leads", request.url));
  response.cookies.set(
    OPERATOR_SESSION_COOKIE,
    createOperatorSessionToken(email),
    getOperatorSessionCookieOptions(),
  );

  return response;
}
