import {
  ApprovalStatus,
  EngagementEventType,
  ExternalSyncStatus,
  type PrismaClient,
} from "@prisma/client";

import { type GmailThreadSnapshot } from "@/lib/providers/google-workspace/gmail";

export type GmailEngagementDatabaseClient = Pick<
  PrismaClient,
  "$transaction" | "gmailDraftLink" | "outreachDraft" | "outreachEngagementEvent"
>;

export async function syncGmailReplyStateForDraft(input: {
  db: GmailEngagementDatabaseClient;
  draft: {
    id: string;
    companyId: string;
    contactId: string | null;
    gmailDraftLink: {
      gmailDraftId: string;
      gmailThreadId: string | null;
      syncStatus: ExternalSyncStatus;
    };
    childDrafts: Array<{ id: string }>;
  };
  thread: GmailThreadSnapshot;
}) {
  const now = new Date();
  const gmailDraftLink = await input.db.gmailDraftLink.upsert({
    where: { outreachDraftId: input.draft.id },
    create: {
      outreachDraftId: input.draft.id,
      gmailDraftId: input.draft.gmailDraftLink.gmailDraftId,
      gmailThreadId: input.thread.threadId,
      syncStatus: ExternalSyncStatus.SYNCED,
      lastSyncedAt: now,
    },
    update: {
      gmailDraftId: input.draft.gmailDraftLink.gmailDraftId,
      gmailThreadId: input.thread.threadId,
      syncStatus: ExternalSyncStatus.SYNCED,
      lastSyncedAt: now,
    },
  });

  if (!input.thread.hasReply) {
    return {
      gmailDraftLink,
      replyEventCreated: false,
    };
  }

  const existingReply = await input.db.outreachEngagementEvent.findFirst({
    where: {
      outreachDraftId: input.draft.id,
      eventType: EngagementEventType.REPLY,
    },
    select: {
      id: true,
    },
  });

  if (existingReply) {
    return {
      gmailDraftLink,
      replyEventCreated: false,
    };
  }

  await input.db.$transaction(async (tx) => {
    await tx.outreachEngagementEvent.create({
      data: {
        outreachDraftId: input.draft.id,
        companyId: input.draft.companyId,
        contactId: input.draft.contactId,
        eventType: EngagementEventType.REPLY,
        followUpCreated: false,
        payload: {
          threadId: input.thread.threadId,
          accountEmail: input.thread.accountEmail,
          messageCount: input.thread.messageCount,
          sentAt: input.thread.sentAt,
          latestMessageAt: input.thread.latestMessageAt,
          latestMessageDirection: input.thread.latestMessageDirection,
          hasReply: input.thread.hasReply,
          replyDetectedAt: input.thread.replyDetectedAt,
          replyMessageId: input.thread.replyMessageId,
          messages: input.thread.messages,
        },
      },
    });

    if (input.draft.childDrafts.length > 0) {
      await tx.outreachDraft.updateMany({
        where: {
          id: {
            in: input.draft.childDrafts.map((childDraft) => childDraft.id),
          },
        },
        data: {
          approvalStatus: ApprovalStatus.REJECTED,
          approvalNotes: "Reply detected in Gmail thread.",
        },
      });
    }
  });

  return {
    gmailDraftLink,
    replyEventCreated: true,
  };
}
