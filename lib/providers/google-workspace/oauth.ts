import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import {
  type GoogleWorkspaceConnection,
  WorkspaceConnectionStatus,
} from "@prisma/client";
import { google } from "googleapis";

import {
  getGoogleOAuthConfig,
  getRequiredTrimmedEnv,
} from "@/lib/config/env";
import { GOOGLE_WORKSPACE_SCOPES } from "@/lib/domain/google-workspace";

type GoogleWorkspaceEnv = NodeJS.ProcessEnv;

function getTokenEncryptionKey(env: GoogleWorkspaceEnv = process.env) {
  return createHash("sha256")
    .update(getRequiredTrimmedEnv("GOOGLE_WORKSPACE_TOKEN_SECRET", env))
    .digest();
}

export function encryptGoogleWorkspaceToken(
  token: string,
  env: GoogleWorkspaceEnv = process.env,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTokenEncryptionKey(env), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptGoogleWorkspaceToken(
  payload: string,
  env: GoogleWorkspaceEnv = process.env,
) {
  const [version, iv, tag, encrypted] = payload.split(":");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Invalid Google Workspace token payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(env),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createGoogleOAuthClient(env: GoogleWorkspaceEnv = process.env) {
  const config = getGoogleOAuthConfig(env);

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
}

export function createGoogleWorkspaceAuthUrl(state: string, env: GoogleWorkspaceEnv = process.env) {
  return createGoogleOAuthClient(env).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_WORKSPACE_SCOPES],
    state,
  });
}

export async function exchangeGoogleWorkspaceCode(
  code: string,
  env: GoogleWorkspaceEnv = process.env,
) {
  const client = createGoogleOAuthClient(env);
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google OAuth exchange did not return an access token.");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: tokens.scope?.split(" ").filter(Boolean) ?? [...GOOGLE_WORKSPACE_SCOPES],
  };
}

export async function fetchGoogleWorkspaceProfile(
  accessToken: string,
  env: GoogleWorkspaceEnv = process.env,
) {
  const auth = createGoogleOAuthClient(env);
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });
  const response = await gmail.users.getProfile({ userId: "me" });

  return response.data;
}

export async function createAuthorizedGoogleClient(
  connection: Pick<
    GoogleWorkspaceConnection,
    "encryptedAccessToken" | "encryptedRefreshToken" | "accessTokenExpiresAt" | "status"
  >,
  env: GoogleWorkspaceEnv = process.env,
) {
  if (connection.status !== WorkspaceConnectionStatus.CONNECTED) {
    throw new Error("Google Workspace is not connected.");
  }

  const auth = createGoogleOAuthClient(env);
  auth.setCredentials({
    access_token: connection.encryptedAccessToken
      ? decryptGoogleWorkspaceToken(connection.encryptedAccessToken, env)
      : undefined,
    refresh_token: connection.encryptedRefreshToken
      ? decryptGoogleWorkspaceToken(connection.encryptedRefreshToken, env)
      : undefined,
    expiry_date: connection.accessTokenExpiresAt?.getTime(),
  });

  if (!auth.credentials.refresh_token) {
    throw new Error("Google Workspace refresh token is missing. Reconnect the account.");
  }

  const shouldRefresh =
    !auth.credentials.access_token ||
    !connection.accessTokenExpiresAt ||
    connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;

  if (shouldRefresh) {
    const refreshed = await auth.refreshAccessToken();
    auth.setCredentials({
      ...auth.credentials,
      access_token: refreshed.credentials.access_token ?? auth.credentials.access_token,
      expiry_date: refreshed.credentials.expiry_date ?? auth.credentials.expiry_date,
    });
  }

  return auth;
}

export async function verifyGoogleWorkspacePushToken(input: {
  idToken: string;
  audience: string;
  serviceAccountEmail?: string | null;
}) {
  const verifier = new google.auth.OAuth2();
  const ticket = await verifier.verifyIdToken({
    idToken: input.idToken,
    audience: input.audience,
  });
  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Google Pub/Sub push token payload was empty.");
  }

  if (payload.email_verified !== true) {
    throw new Error("Google Pub/Sub push token email was not verified.");
  }

  if (input.serviceAccountEmail && payload.email !== input.serviceAccountEmail) {
    throw new Error("Google Pub/Sub push token email did not match the configured service account.");
  }

  return payload;
}
