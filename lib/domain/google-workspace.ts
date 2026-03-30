import { WorkspaceConnectionStatus } from "@prisma/client";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export function getGoogleWorkspaceEnvState(env: NodeJS.ProcessEnv = process.env) {
  return {
    hasClientId: Boolean(env.GOOGLE_OAUTH_CLIENT_ID),
    hasClientSecret: Boolean(env.GOOGLE_OAUTH_CLIENT_SECRET),
    hasRedirectUri: Boolean(env.GOOGLE_OAUTH_REDIRECT_URI),
    hasSpreadsheetId: Boolean(env.GOOGLE_SHEETS_SPREADSHEET_ID),
    hasTokenSecret: Boolean(env.GOOGLE_WORKSPACE_TOKEN_SECRET),
  };
}

export function deriveGoogleWorkspaceState(input: {
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasRedirectUri: boolean;
  hasSpreadsheetId: boolean;
  hasTokenSecret: boolean;
  connection:
    | {
        status: WorkspaceConnectionStatus;
        email?: string | null;
        scopes?: unknown;
      }
    | null;
}) {
  const configReady =
    input.hasClientId &&
    input.hasClientSecret &&
    input.hasRedirectUri &&
    input.hasSpreadsheetId &&
    input.hasTokenSecret;

  if (!configReady) {
    return {
      status: "CONFIG_INCOMPLETE",
      canStartOAuth: false,
      connectedEmail: undefined,
    } as const;
  }

  if (!input.connection || input.connection.status === WorkspaceConnectionStatus.DISCONNECTED) {
    return {
      status: "DISCONNECTED",
      canStartOAuth: true,
      connectedEmail: undefined,
    } as const;
  }

  if (input.connection.status === WorkspaceConnectionStatus.ERROR) {
    return {
      status: "ERROR",
      canStartOAuth: true,
      connectedEmail: input.connection.email ?? undefined,
    } as const;
  }

  const grantedScopes = Array.isArray(input.connection.scopes)
    ? input.connection.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  const hasAllRequiredScopes = GOOGLE_WORKSPACE_SCOPES.every((scope) => grantedScopes.includes(scope));

  if (!hasAllRequiredScopes) {
    return {
      status: "ERROR",
      canStartOAuth: true,
      connectedEmail: input.connection.email ?? undefined,
    } as const;
  }

  return {
    status: "CONNECTED",
    canStartOAuth: true,
    connectedEmail: input.connection.email ?? undefined,
  } as const;
}

export function getGoogleWorkspaceStatusCopy(
  status: ReturnType<typeof deriveGoogleWorkspaceState>["status"],
) {
  switch (status) {
    case "CONFIG_INCOMPLETE":
      return {
        title: "Google Workspace needs setup",
        description: "Add the OAuth, Sheets, and token-encryption env vars before connecting.",
      };
    case "DISCONNECTED":
      return {
        title: "Google Workspace not connected",
        description: "Connect Gmail and Google Sheets to turn approved drafts into real handoffs.",
      };
    case "ERROR":
      return {
        title: "Google Workspace needs attention",
        description:
          "Reconnect Google Workspace to refresh tokens, grant the latest Gmail and Forms scopes, or clear the last connection error.",
      };
    case "CONNECTED":
      return {
        title: "Google Workspace connected",
        description:
          "Approved drafts can now create Gmail drafts, sync to your operator sheet, and create live Google Forms.",
      };
  }
}
