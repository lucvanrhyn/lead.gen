import { google } from "googleapis";

type DraftSheetRowInput = {
  draftId: string;
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  approvalStatus: string;
  emailSubject: string;
  gmailSyncStatus: string;
  sheetSyncStatus: string;
  leadUrl: string;
};

export function buildDraftSheetRow(input: DraftSheetRowInput) {
  return [
    input.draftId,
    input.companyName,
    input.contactName ?? "",
    input.contactEmail ?? "",
    input.approvalStatus,
    input.emailSubject,
    input.gmailSyncStatus,
    input.sheetSyncStatus,
    input.leadUrl,
  ];
}

export function extractSheetRowKey(updatedRange?: string | null) {
  const match = updatedRange?.match(/![A-Z]+(\d+):/i);
  return match?.[1] ?? null;
}

export async function upsertGoogleSheetDraftRow(input: {
  auth: unknown;
  spreadsheetId: string;
  row: string[];
  rowKey?: string | null;
}) {
  const sheets = google.sheets({ version: "v4", auth: input.auth as never });

  if (input.rowKey) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: input.spreadsheetId,
      range: `Drafts!A${input.rowKey}:I${input.rowKey}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [input.row],
      },
    });

    return {
      rowKey: input.rowKey,
      updatedRange: `Drafts!A${input.rowKey}:I${input.rowKey}`,
    };
  }

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: input.spreadsheetId,
    range: "Drafts!A:I",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [input.row],
    },
  });

  const updatedRange =
    response.data.updates?.updatedRange ?? response.data.tableRange ?? null;

  return {
    rowKey: extractSheetRowKey(updatedRange),
    updatedRange,
  };
}
