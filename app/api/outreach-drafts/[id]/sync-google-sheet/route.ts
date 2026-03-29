import { ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  buildDraftSheetRow,
  upsertGoogleSheetDraftRow,
} from "@/lib/providers/google-workspace/sheets";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_SPREADSHEET_ID is not configured." },
      { status: 503 },
    );
  }

  const draft = await db.outreachDraft.findUnique({
    where: { id },
    include: {
      company: true,
      contact: true,
      gmailDraftLink: true,
      sheetSyncRecords: {
        where: { tabName: "Drafts" },
        take: 1,
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
  }

  if (draft.approvalStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "Only approved outreach drafts can sync to Google Sheets." },
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

  try {
    const auth = await createAuthorizedGoogleClient(connection);
    const row = buildDraftSheetRow({
      draftId: draft.id,
      companyName: draft.company.name,
      contactName: draft.contact?.fullName,
      contactEmail: draft.contact?.email,
      approvalStatus: draft.approvalStatus,
      emailSubject: draft.emailSubject1,
      gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? "NOT_READY",
      sheetSyncStatus: draft.sheetSyncRecords[0]?.syncStatus ?? "NOT_READY",
      leadUrl: new URL(`/leads/${draft.companyId}`, request.url).toString(),
    });

    const result = await upsertGoogleSheetDraftRow({
      auth,
      spreadsheetId,
      row,
      rowKey: draft.sheetSyncRecords[0]?.rowKey,
    });

    const record = await db.sheetSyncRecord.upsert({
      where: {
        outreachDraftId_tabName: {
          outreachDraftId: id,
          tabName: "Drafts",
        },
      },
      create: {
        outreachDraftId: id,
        tabName: "Drafts",
        rowKey: result.rowKey ?? "pending",
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
      update: {
        rowKey: result.rowKey ?? draft.sheetSyncRecords[0]?.rowKey ?? "pending",
        syncStatus: ExternalSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Syncing the draft to Google Sheets failed.";

    await db.sheetSyncRecord.upsert({
      where: {
        outreachDraftId_tabName: {
          outreachDraftId: id,
          tabName: "Drafts",
        },
      },
      create: {
        outreachDraftId: id,
        tabName: "Drafts",
        rowKey: "failed",
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
