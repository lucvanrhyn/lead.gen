import { ExternalSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveAppUrl } from "@/lib/domain/app-url";
import {
  buildCompanySheetRow,
  buildContactSheetRow,
  buildDraftSheetRow,
  buildEngagementSheetRow,
  buildLinkedInTaskSheetRow,
  upsertGoogleSheetRow,
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
      company: {
        include: {
          leadScores: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      contact: true,
      gmailDraftLink: true,
      linkedinTask: true,
      engagementEvents: {
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      sheetSyncRecords: {
        orderBy: { createdAt: "desc" },
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
    const leadUrl = resolveAppUrl(`/leads/${draft.companyId}`, process.env, request);
    const syncRecordByTab = new Map(
      draft.sheetSyncRecords.map((record) => [record.tabName, record]),
    );
    const latestEngagement = draft.engagementEvents[0];
    const rows = [
      {
        tabName: "Companies" as const,
        row: buildCompanySheetRow({
          companyId: draft.company.id,
          companyName: draft.company.name,
          industry: draft.company.industry,
          locationSummary: draft.company.locationSummary,
          website: draft.company.website,
          phone: draft.company.phone,
          status: draft.company.status,
          scoreLabel: draft.company.leadScores[0]?.totalScore != null
            ? `${draft.company.leadScores[0].totalScore} / 100`
            : "Unscored",
          leadUrl,
        }),
      },
      {
        tabName: "Contacts" as const,
        row: buildContactSheetRow({
          draftId: draft.id,
          companyName: draft.company.name,
          contactName: draft.contact?.fullName,
          contactTitle: draft.contact?.title,
          contactEmail: draft.contact?.email,
          contactPhone: draft.contact?.phone,
          confidenceLabel:
            draft.contact?.decisionMakerConfidence == null
              ? ""
              : draft.contact.decisionMakerConfidence.toFixed(2),
          leadUrl,
        }),
      },
      {
        tabName: "Drafts" as const,
        row: buildDraftSheetRow({
          draftId: draft.id,
          companyName: draft.company.name,
          contactName: draft.contact?.fullName,
          contactEmail: draft.contact?.email,
          approvalStatus: draft.approvalStatus,
          emailSubject: draft.emailSubject1,
          gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? "NOT_READY",
          sheetSyncStatus: syncRecordByTab.get("Drafts")?.syncStatus ?? "NOT_READY",
          leadUrl,
        }),
      },
      {
        tabName: "LinkedIn Tasks" as const,
        row: buildLinkedInTaskSheetRow({
          draftId: draft.id,
          contactName: draft.linkedinTask?.contactName,
          lookupStatus: draft.linkedinTask?.status ?? "NOT_READY",
          profileUrl: draft.linkedinTask?.linkedinProfileUrl,
          connectionRequestNote: draft.linkedinTask?.connectionRequestNote ?? "",
        }),
      },
      {
        tabName: "Engagement" as const,
        row: buildEngagementSheetRow({
          draftId: draft.id,
          latestEventType: latestEngagement?.eventType,
          latestEventAt: latestEngagement?.occurredAt.toISOString().slice(0, 16).replace("T", " "),
          followUpCreated: latestEngagement?.followUpCreated ?? false,
        }),
      },
    ];

    const records = [];

    for (const item of rows) {
      const result = await upsertGoogleSheetRow({
        auth,
        spreadsheetId,
        tabName: item.tabName,
        row: item.row,
        rowKey: syncRecordByTab.get(item.tabName)?.rowKey,
      });

      const record = await db.sheetSyncRecord.upsert({
        where: {
          outreachDraftId_tabName: {
            outreachDraftId: id,
            tabName: item.tabName,
          },
        },
        create: {
          outreachDraftId: id,
          tabName: item.tabName,
          rowKey: result.rowKey ?? "pending",
          syncStatus: ExternalSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
        update: {
          rowKey: result.rowKey ?? syncRecordByTab.get(item.tabName)?.rowKey ?? "pending",
          syncStatus: ExternalSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
      });

      records.push(record);
    }

    return NextResponse.json({ records });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Syncing the draft to Google Sheets failed.";

    await Promise.all(
      ["Companies", "Contacts", "Drafts", "LinkedIn Tasks", "Engagement"].map((tabName) =>
        db.sheetSyncRecord.upsert({
          where: {
            outreachDraftId_tabName: {
              outreachDraftId: id,
              tabName,
            },
          },
          create: {
            outreachDraftId: id,
            tabName,
            rowKey: "failed",
            syncStatus: ExternalSyncStatus.FAILED,
            lastSyncedAt: new Date(),
          },
          update: {
            syncStatus: ExternalSyncStatus.FAILED,
            lastSyncedAt: new Date(),
          },
        }),
      ),
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
