import { ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const gmailSyncSchema = z.object({
  gmailDraftId: z.string().min(1),
  gmailThreadId: z.string().min(1).optional(),
  syncStatus: z.nativeEnum(ExternalSyncStatus).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = gmailSyncSchema.parse(await request.json());

    const record = await db.gmailDraftLink.upsert({
      where: { outreachDraftId: id },
      create: {
        outreachDraftId: id,
        gmailDraftId: input.gmailDraftId,
        gmailThreadId: input.gmailThreadId,
        syncStatus: input.syncStatus ?? ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
      update: {
        gmailDraftId: input.gmailDraftId,
        gmailThreadId: input.gmailThreadId,
        syncStatus: input.syncStatus ?? ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid Gmail sync request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Saving Gmail sync metadata failed.",
      },
      { status: 500 },
    );
  }
}
