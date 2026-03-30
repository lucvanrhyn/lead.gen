import { ExternalSyncStatus, WorkspaceConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { registerGoogleWorkspaceGmailWatch } from "@/lib/providers/google-workspace/gmail";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function isRenewalDue(expiresAt?: Date | null) {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() <= Date.now() + RENEWAL_WINDOW_MS;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicName = process.env.GOOGLE_GMAIL_PUBSUB_TOPIC?.trim();

  if (!topicName) {
    return NextResponse.json({
      ok: true,
      renewed: false,
      skipped: true,
      reason: "config-missing",
    });
  }

  const connection = await db.googleWorkspaceConnection.findUnique({
    where: { provider: "google_workspace" },
  });

  if (!connection || connection.status !== WorkspaceConnectionStatus.CONNECTED) {
    return NextResponse.json({
      ok: true,
      renewed: false,
      skipped: true,
      reason: "not-connected",
    });
  }

  if (!isRenewalDue(connection.gmailWatchExpiresAt)) {
    return NextResponse.json({
      ok: true,
      renewed: false,
      skipped: true,
      reason: "not-due",
    });
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

    return NextResponse.json({
      ok: true,
      renewed: true,
      skipped: false,
      historyId: watch.historyId,
      expiration: watch.expiration,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gmail watch renewal failed.";

    await db.googleWorkspaceConnection.update({
      where: { provider: "google_workspace" },
      data: {
        gmailWatchStatus: ExternalSyncStatus.FAILED,
        gmailWatchLastError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
