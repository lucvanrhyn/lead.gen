import { WorkspaceConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  encryptGoogleWorkspaceToken,
  exchangeGoogleWorkspaceCode,
  fetchGoogleWorkspaceProfile,
} from "@/lib/providers/google-workspace/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_workspace_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/leads?workspace=error", request.url));
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
        lastError: null,
      },
      update: {
        email: profile.emailAddress ?? null,
        scopes: tokens.scopes,
        encryptedAccessToken: encryptGoogleWorkspaceToken(tokens.accessToken),
        encryptedRefreshToken,
        accessTokenExpiresAt: tokens.expiryDate,
        status: WorkspaceConnectionStatus.CONNECTED,
        lastError: null,
      },
    });

    const response = NextResponse.redirect(new URL("/leads?workspace=connected", request.url));
    response.cookies.set("google_workspace_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    await db.googleWorkspaceConnection.upsert({
      where: { provider: "google_workspace" },
      create: {
        provider: "google_workspace",
        scopes: [],
        status: WorkspaceConnectionStatus.ERROR,
        lastError: error instanceof Error ? error.message : "Google Workspace callback failed.",
      },
      update: {
        status: WorkspaceConnectionStatus.ERROR,
        lastError: error instanceof Error ? error.message : "Google Workspace callback failed.",
      },
    });

    return NextResponse.redirect(new URL("/leads?workspace=error", request.url));
  }
}
