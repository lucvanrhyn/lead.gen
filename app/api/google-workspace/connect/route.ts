import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getGoogleWorkspaceEnvState } from "@/lib/domain/google-workspace";
import { createGoogleWorkspaceAuthUrl } from "@/lib/providers/google-workspace/oauth";

export async function GET() {
  const envState = getGoogleWorkspaceEnvState();

  if (
    !envState.hasClientId ||
    !envState.hasClientSecret ||
    !envState.hasRedirectUri ||
    !envState.hasSpreadsheetId ||
    !envState.hasTokenSecret
  ) {
    return NextResponse.json(
      { error: "Google Workspace env is incomplete." },
      { status: 503 },
    );
  }

  const state = randomUUID();
  const response = NextResponse.redirect(createGoogleWorkspaceAuthUrl(state));

  response.cookies.set("google_workspace_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
