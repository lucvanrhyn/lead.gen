import { ExternalSyncStatus, WorkspaceConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";
import { registerGoogleWorkspaceGmailWatch } from "@/lib/providers/google-workspace/gmail";

function redirectToLeads(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/leads?gmailWatch=${status}`, request.url));
}

export async function POST(request: Request) {
  const topicName = process.env.GOOGLE_GMAIL_PUBSUB_TOPIC?.trim();

  if (!topicName) {
    return redirectToLeads(request, "config-error");
  }

  const connection = await db.googleWorkspaceConnection.findUnique({
    where: { provider: "google_workspace" },
  });

  if (!connection || connection.status !== WorkspaceConnectionStatus.CONNECTED) {
    return redirectToLeads(request, "not-connected");
  }

  try {
    const auth = await createAuthorizedGoogleClient(connection);
    const watch = await registerGoogleWorkspaceGmailWatch({
      auth,
      topicName,
      labelIds: ["INBOX"],
    });

    await db.googleWorkspaceConnection.update({
      where: { provider: "google_workspace" },
      data: {
        gmailWatchTopic: watch.topicName,
        gmailWatchHistoryId: watch.historyId,
        gmailWatchExpiresAt: watch.expiration ? new Date(watch.expiration) : null,
        gmailWatchStatus: ExternalSyncStatus.SYNCED,
        gmailWatchLastError: null,
      },
    });

    return redirectToLeads(request, "connected");
  } catch (error) {
    await db.googleWorkspaceConnection.update({
      where: { provider: "google_workspace" },
      data: {
        gmailWatchStatus: ExternalSyncStatus.FAILED,
        gmailWatchLastError:
          error instanceof Error ? error.message : "Gmail watch registration failed.",
      },
    });

    return redirectToLeads(request, "error");
  }
}
