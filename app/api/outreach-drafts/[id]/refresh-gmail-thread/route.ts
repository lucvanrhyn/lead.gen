import { ApprovalStatus, EngagementEventType, ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  fetchGoogleWorkspaceGmailThread,
} from "@/lib/providers/google-workspace/gmail";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const draft = await db.outreachDraft.findUnique({
      where: { id },
      include: {
        gmailDraftLink: true,
        childDrafts: {
          where: {
            draftType: "FOLLOW_UP",
            approvalStatus: {
              in: ["PENDING_APPROVAL", "APPROVED"],
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
    }

    if (draft.approvalStatus === ApprovalStatus.REJECTED) {
      return NextResponse.json(
        { error: "Rejected outreach drafts cannot refresh Gmail threads." },
        { status: 409 },
      );
    }

    if (!draft.gmailDraftLink?.gmailThreadId) {
      return NextResponse.json(
        { error: "This draft does not have a Gmail thread to refresh yet." },
        { status: 409 },
      );
    }

    const connection = await db.googleWorkspaceConnection.findUnique({
      where: { provider: "google_workspace" },
    });

    if (!connection || connection.status !== "CONNECTED") {
      return NextResponse.json(
        { error: "Google Workspace is not connected yet." },
        { status: 503 },
      );
    }

    const auth = await createAuthorizedGoogleClient(connection);
    const thread = await fetchGoogleWorkspaceGmailThread({
      auth,
      threadId: draft.gmailDraftLink.gmailThreadId,
    });
    const now = new Date();

    const gmailDraftLink = await db.gmailDraftLink.upsert({
      where: { outreachDraftId: id },
      create: {
        outreachDraftId: id,
        gmailDraftId: draft.gmailDraftLink.gmailDraftId,
        gmailThreadId: thread.threadId,
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: now,
      },
      update: {
        gmailDraftId: draft.gmailDraftLink.gmailDraftId,
        gmailThreadId: thread.threadId,
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: now,
      },
    });

    let replyEventCreated = false;
    if (thread.hasReply) {
      const existingReply = await db.outreachEngagementEvent.findFirst({
        where: {
          outreachDraftId: id,
          eventType: EngagementEventType.REPLY,
        },
        select: {
          id: true,
        },
      });

      if (!existingReply) {
        await db.outreachEngagementEvent.create({
          data: {
            outreachDraftId: id,
            companyId: draft.companyId,
            contactId: draft.contactId,
            eventType: EngagementEventType.REPLY,
            followUpCreated: false,
            payload: {
              threadId: thread.threadId,
              accountEmail: thread.accountEmail,
              messageCount: thread.messageCount,
              sentAt: thread.sentAt,
              latestMessageAt: thread.latestMessageAt,
              latestMessageDirection: thread.latestMessageDirection,
              hasReply: thread.hasReply,
              replyDetectedAt: thread.replyDetectedAt,
              replyMessageId: thread.replyMessageId,
              messages: thread.messages,
            },
          },
        });
        if (draft.childDrafts.length > 0) {
          await db.outreachDraft.updateMany({
            where: {
              id: {
                in: draft.childDrafts.map((childDraft) => childDraft.id),
              },
            },
            data: {
              approvalStatus: ApprovalStatus.REJECTED,
              approvalNotes: "Reply detected in Gmail thread.",
            },
          });
        }
        replyEventCreated = true;
      }
    }

    return NextResponse.json({
      gmailDraftLink,
      thread,
      replyEventCreated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Refreshing the Gmail thread failed.",
      },
      { status: 500 },
    );
  }
}
