import { ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createGoogleWorkspaceGmailDraft } from "@/lib/providers/google-workspace/gmail";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const draft = await db.outreachDraft.findUnique({
    where: { id },
    include: {
      contact: true,
      gmailDraftLink: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
  }

  if (draft.approvalStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "Only approved outreach drafts can create Gmail drafts." },
      { status: 409 },
    );
  }

  if (!draft.contact?.email) {
    return NextResponse.json(
      { error: "This draft does not have a contact email yet." },
      { status: 422 },
    );
  }

  if (
    draft.gmailDraftLink?.syncStatus === ExternalSyncStatus.SYNCED &&
    draft.gmailDraftLink.gmailDraftId &&
    !draft.gmailDraftLink.gmailDraftId.startsWith("pending-")
  ) {
    return NextResponse.json(draft.gmailDraftLink);
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

  try {
    const auth = await createAuthorizedGoogleClient(connection);
    const gmailDraft = await createGoogleWorkspaceGmailDraft({
      auth,
      to: draft.contact.email,
      subject: draft.emailSubject1,
      body: draft.coldEmailMedium,
    });

    const record = await db.gmailDraftLink.upsert({
      where: { outreachDraftId: id },
      create: {
        outreachDraftId: id,
        gmailDraftId: gmailDraft.gmailDraftId,
        gmailThreadId: gmailDraft.gmailThreadId ?? undefined,
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
      update: {
        gmailDraftId: gmailDraft.gmailDraftId,
        gmailThreadId: gmailDraft.gmailThreadId ?? undefined,
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Creating the Gmail draft failed.";

    await db.gmailDraftLink.upsert({
      where: { outreachDraftId: id },
      create: {
        outreachDraftId: id,
        gmailDraftId: `failed-${id}`,
        syncStatus: ExternalSyncStatus.FAILED,
        lastSyncedAt: new Date(),
      },
      update: {
        syncStatus: ExternalSyncStatus.FAILED,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
