import { ApprovalStatus, ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existingDraft = await db.outreachDraft.findUnique({
    where: { id },
    include: {
      contact: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!existingDraft) {
    return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
  }

  const connection = await db.googleWorkspaceConnection.findUnique({
    where: { provider: "google_workspace" },
    select: {
      status: true,
    },
  });

  const draft = await db.outreachDraft.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  const isGmailReady = Boolean(existingDraft.contact?.email) && connection?.status === "CONNECTED";
  const syncStatus = isGmailReady ? ExternalSyncStatus.READY : ExternalSyncStatus.NOT_READY;

  await db.gmailDraftLink.upsert({
    where: { outreachDraftId: id },
    create: {
      outreachDraftId: id,
      gmailDraftId: `pending-${id}`,
      syncStatus,
    },
    update: {
      syncStatus,
      lastSyncedAt: null,
    },
  });

  return NextResponse.json({
    ...draft,
    gmailReady: isGmailReady,
  });
}
