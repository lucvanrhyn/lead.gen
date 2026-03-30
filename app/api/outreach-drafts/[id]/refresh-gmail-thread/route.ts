import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { syncGmailReplyStateForDraft } from "@/lib/domain/gmail-engagement";
import { fetchGoogleWorkspaceGmailThread } from "@/lib/providers/google-workspace/gmail";
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
    const { gmailDraftLink, replyEventCreated } = await syncGmailReplyStateForDraft({
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
