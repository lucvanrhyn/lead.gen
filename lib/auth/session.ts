import { createHmac, timingSafeEqual } from "node:crypto";

import {
  getRequiredTrimmedEnv,
  getOptionalTrimmedEnv,
} from "@/lib/config/env";

type EnvSource = NodeJS.ProcessEnv;

type OperatorSessionPayload = {
  email: string;
  exp: number;
};

export const OPERATOR_SESSION_COOKIE = "leadgen_operator_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function createSignature(value: string, env: EnvSource = process.env) {
  return createHmac("sha256", getRequiredTrimmedEnv("OPERATOR_SESSION_SECRET", env))
    .update(value)
    .digest("base64url");
}

function encodePayload(payload: OperatorSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(token: string) {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as OperatorSessionPayload;
}

function equalSignatures(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function hasValidOperatorCredentials(
  email: string,
  password: string,
  env: EnvSource = process.env,
) {
  const configuredEmail = getOptionalTrimmedEnv("OPERATOR_EMAIL", env);
  const configuredPassword = getOptionalTrimmedEnv("OPERATOR_PASSWORD", env);

  if (!configuredEmail || !configuredPassword) {
    return false;
  }

  return equalSignatures(configuredEmail, email.trim()) && equalSignatures(configuredPassword, password);
}

export function createOperatorSessionToken(
  email: string,
  env: EnvSource = process.env,
) {
  const payload = encodePayload({
    email: email.trim(),
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  });

  return `${payload}.${createSignature(payload, env)}`;
}

export function readOperatorSessionToken(
  token?: string | null,
  env: EnvSource = process.env,
) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = createSignature(payload, env);

  if (!equalSignatures(signature, expected)) {
    return null;
  }

  try {
    const parsed = decodePayload(payload);

    if (!parsed.email || parsed.exp <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getOperatorSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
