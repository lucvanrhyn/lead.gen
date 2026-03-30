import { ExternalSyncStatus, WorkspaceConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOperatorSessionFromCookieHeader } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  encryptGoogleWorkspaceToken,
  exchangeGoogleWorkspaceCode,
  fetchGoogleWorkspaceProfile,
} from "@/lib/providers/google-workspace/oauth";

function getCookieValue(cookieHeader: string | null, name: string) {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
}

function createCallbackRedirect(
  request: Request,
  input:
    | { status: "connected" }
    | { status: "error"; reason: string },
) {
  const session = getOperatorSessionFromCookieHeader(request.headers.get("cookie"));
  const redirectUrl = new URL(
    input.status === "error" && !session ? "/login" : "/leads",
    request.url,
  );

  if (input.status === "error" && !session) {
    redirectUrl.searchParams.set("error", "google_workspace_callback");
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("workspace", input.status);

  if (input.status === "error") {
    redirectUrl.searchParams.set("reason", input.reason);
  }

  return NextResponse.redirect(redirectUrl);
}

function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set("google_workspace_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

async function persistWorkspaceError(message: string) {
  try {
    await db.googleWorkspaceConnection.upsert({
      where: { provider: "google_workspace" },
      create: {
        provider: "google_workspace",
        scopes: [],
        status: WorkspaceConnectionStatus.ERROR,
        lastError: message,
      },
      update: {
        status: WorkspaceConnectionStatus.ERROR,
        lastError: message,
      },
    });
  } catch {
    // Best effort only. Redirecting the operator back with context is more important than failing here.
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const cookieState = getCookieValue(
    request.headers.get("cookie"),
    "google_workspace_oauth_state",
  );

  if (providerError) {
    const response = createCallbackRedirect(request, {
      status: "error",
      reason: providerError,
    });
    clearOAuthStateCookie(response);
    await persistWorkspaceError(`Google OAuth returned "${providerError}".`);
    return response;
  }

  if (!code) {
    const response = createCallbackRedirect(request, {
      status: "error",
      reason: "missing_code",
    });
    clearOAuthStateCookie(response);
    await persistWorkspaceError("Google OAuth callback did not include an authorization code.");
    return response;
  }

  if (!state || !cookieState || state !== cookieState) {
    const response = createCallbackRedirect(request, {
      status: "error",
      reason: "invalid_state",
    });
    clearOAuthStateCookie(response);
    await persistWorkspaceError("Google OAuth state validation failed. Start the connection again.");
    return response;
  }

  try {
    const existingConnection = await db.googleWorkspaceConnection.findUnique({
      where: { provider: "google_workspace" },
    });
    const tokens = await exchangeGoogleWorkspaceCode(code);
    const profile = await fetchGoogleWorkspaceProfile(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encryptGoogleWorkspaceToken(tokens.refreshToken)
      : existingConnection?.encryptedRefreshToken;

    if (!encryptedRefreshToken) {
      throw new Error("Google OAuth did not return a refresh token. Reconnect with consent.");
    }

    await db.googleWorkspaceConnection.upsert({
      where: { provider: "google_workspace" },
      create: {
        provider: "google_workspace",
        email: profile.emailAddress ?? null,
        scopes: tokens.scopes,
        encryptedAccessToken: encryptGoogleWorkspaceToken(tokens.accessToken),
        encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiryDate,
        status: WorkspaceConnectionStatus.CONNECTED,
        gmailWatchStatus: ExternalSyncStatus.NOT_READY,
        gmailWatchHistoryId: null,
        gmailWatchExpiresAt: null,
        gmailWatchTopic: null,
        gmailWatchLastError: null,
        gmailWatchLastNotificationAt: null,
        lastError: null,
      },
      update: {
        email: profile.emailAddress ?? null,
        scopes: tokens.scopes,
        encryptedAccessToken: encryptGoogleWorkspaceToken(tokens.accessToken),
        encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiryDate,
        status: WorkspaceConnectionStatus.CONNECTED,
        gmailWatchStatus: ExternalSyncStatus.NOT_READY,
        gmailWatchHistoryId: null,
        gmailWatchExpiresAt: null,
        gmailWatchTopic: null,
        gmailWatchLastError: null,
        gmailWatchLastNotificationAt: null,
        lastError: null,
      },
    });

    return clearOAuthStateCookie(createCallbackRedirect(request, { status: "connected" }));
  } catch (error) {
    await persistWorkspaceError(
      error instanceof Error ? error.message : "Google Workspace callback failed.",
    );

    return clearOAuthStateCookie(createCallbackRedirect(request, {
      status: "error",
      reason: "token_exchange_failed",
    }));
  }
}
