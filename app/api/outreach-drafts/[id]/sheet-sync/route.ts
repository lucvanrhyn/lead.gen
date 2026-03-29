import { ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const sheetSyncSchema = z.object({
  tabName: z.string().min(1),
  rowKey: z.string().min(1),
  syncStatus: z.nativeEnum(ExternalSyncStatus).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = sheetSyncSchema.parse(await request.json());

    const record = await db.sheetSyncRecord.upsert({
      where: {
        outreachDraftId_tabName: {
          outreachDraftId: id,
          tabName: input.tabName,
        },
      },
      create: {
        outreachDraftId: id,
        tabName: input.tabName,
        rowKey: input.rowKey,
        syncStatus: input.syncStatus ?? ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
      update: {
        rowKey: input.rowKey,
        syncStatus: input.syncStatus ?? ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid Google Sheets sync request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Saving Sheets sync metadata failed.",
      },
      { status: 500 },
    );
  }
}
