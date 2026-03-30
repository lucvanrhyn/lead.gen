import { cookies } from "next/headers";

import {
  OPERATOR_SESSION_COOKIE,
  readOperatorSessionToken,
} from "@/lib/auth/session";

export async function getOperatorSession() {
  const cookieStore = await cookies();
  return readOperatorSessionToken(
    cookieStore.get(OPERATOR_SESSION_COOKIE)?.value,
  );
}

export function getOperatorSessionFromCookieHeader(cookieHeader?: string | null) {
  const token = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OPERATOR_SESSION_COOKIE}=`))
    ?.slice(`${OPERATOR_SESSION_COOKIE}=`.length);

  return readOperatorSessionToken(token);
}
