import { ExternalSyncStatus, WorkspaceConnectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { syncGmailReplyStateForDraft } from "@/lib/domain/gmail-engagement";
import {
  fetchGoogleWorkspaceGmailHistory,
  fetchGoogleWorkspaceGmailThread,
} from "@/lib/providers/google-workspace/gmail";
import {
  createAuthorizedGoogleClient,
  verifyGoogleWorkspacePushToken,
} from "@/lib/providers/google-workspace/oauth";

const pubSubEnvelopeSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
});

const gmailPushPayloadSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string(),
});

async function verifyPushRequest(request: Request) {
  const audience = process.env.GOOGLE_GMAIL_PUSH_AUDIENCE?.trim();

  if (!audience) {
    return;
  }

  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch?.[1]) {
    throw new Error("Missing Google Pub/Sub bearer token.");
  }

  await verifyGoogleWorkspacePushToken({
    idToken: bearerMatch[1],
    audience,
    serviceAccountEmail: process.env.GOOGLE_GMAIL_PUSH_SERVICE_ACCOUNT_EMAIL?.trim() || null,
  });
}

export async function POST(request: Request) {
  try {
    await verifyPushRequest(request);

    const connection = await db.googleWorkspaceConnection.findUnique({
      where: { provider: "google_workspace" },
    });

    if (!connection || connection.status !== WorkspaceConnectionStatus.CONNECTED) {
      return NextResponse.json({ ok: true, skipped: "workspace-not-connected" });
    }

    const envelope = pubSubEnvelopeSchema.parse(await request.json());
    const decoded = Buffer.from(envelope.message.data, "base64").toString("utf8");
    const notification = gmailPushPayloadSchema.parse(JSON.parse(decoded));

    if (connection.email && notification.emailAddress.toLowerCase() !== connection.email.toLowerCase()) {
      return NextResponse.json({ ok: true, skipped: "workspace-email-mismatch" });
    }

    if (!connection.gmailWatchHistoryId) {
      await db.googleWorkspaceConnection.update({
        where: { provider: "google_workspace" },
        data: {
          gmailWatchHistoryId: notification.historyId,
          gmailWatchStatus: ExternalSyncStatus.SYNCED,
          gmailWatchLastNotificationAt: new Date(),
          gmailWatchLastError: null,
        },
      });

      return NextResponse.json({ ok: true, processedDrafts: 0, threadCount: 0 });
    }

    const auth = await createAuthorizedGoogleClient(connection);
    const history = await fetchGoogleWorkspaceGmailHistory({
      auth,
      startHistoryId: connection.gmailWatchHistoryId,
    });

    const drafts = history.threadIds.length
      ? await db.outreachDraft.findMany({
          where: {
            approvalStatus: {
              in: ["PENDING_APPROVAL", "APPROVED"],
            },
            gmailDraftLink: {
              is: {
                gmailThreadId: {
                  in: history.threadIds,
                },
                syncStatus: ExternalSyncStatus.SYNCED,
              },
            },
          },
          include: {
            gmailDraftLink: true,
            childDrafts: {
              where: {
                draftType: "FOLLOW_UP",
                approvalStatus: {
                  in: ["PENDING_APPROVAL", "APPROVED"],
                },
              },
              select: { id: true },
            },
          },
        })
      : [];

    let replyEventsCreated = 0;

    for (const draft of drafts) {
      if (!draft.gmailDraftLink?.gmailThreadId) {
        continue;
      }

      const thread = await fetchGoogleWorkspaceGmailThread({
        auth,
        threadId: draft.gmailDraftLink.gmailThreadId,
      });
      const result = await syncGmailReplyStateForDraft({
        db,
        draft: {
          id: draft.id,
          companyId: draft.companyId,
          contactId: draft.contactId,
          gmailDraftLink: {
            gmailDraftId: draft.gmailDraftLink.gmailDraftId,
            gmailThreadId: draft.gmailDraftLink.gmailThreadId,
            syncStatus: draft.gmailDraftLink.syncStatus,
          },
          childDrafts: draft.childDrafts,
        },
        thread,
      });

      if (result.replyEventCreated) {
        replyEventsCreated += 1;
      }
    }

    await db.googleWorkspaceConnection.update({
      where: { provider: "google_workspace" },
      data: {
        gmailWatchHistoryId: history.historyId ?? notification.historyId,
        gmailWatchStatus: ExternalSyncStatus.SYNCED,
        gmailWatchLastNotificationAt: new Date(),
        gmailWatchLastError: null,
      },
    });

    return NextResponse.json({
      ok: true,
      threadCount: history.threadIds.length,
      processedDrafts: drafts.length,
      replyEventsCreated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing the Gmail watch webhook failed.";

    await db.googleWorkspaceConnection.updateMany({
      where: { provider: "google_workspace" },
      data: {
        gmailWatchStatus: ExternalSyncStatus.FAILED,
        gmailWatchLastError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
