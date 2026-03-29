import { ApprovalStatus, ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const draft = await db.outreachDraft.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  await db.gmailDraftLink.upsert({
    where: { outreachDraftId: id },
    create: {
      outreachDraftId: id,
      gmailDraftId: `pending-${id}`,
      syncStatus: ExternalSyncStatus.READY,
    },
    update: {
      syncStatus: ExternalSyncStatus.READY,
      lastSyncedAt: null,
    },
  });

  return NextResponse.json(draft);
}
