import { google } from "googleapis";

type CompanySheetRowInput = {
  companyId: string;
  companyName: string;
  industry?: string | null;
  locationSummary?: string | null;
  website?: string | null;
  phone?: string | null;
  status: string;
  scoreLabel: string;
  leadUrl: string;
};

type ContactSheetRowInput = {
  draftId: string;
  companyName: string;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  confidenceLabel?: string | null;
  leadUrl: string;
};

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

type LinkedInSheetRowInput = {
  draftId: string;
  contactName?: string | null;
  lookupStatus: string;
  profileUrl?: string | null;
  connectionRequestNote: string;
};

type EngagementSheetRowInput = {
  draftId: string;
  latestEventType?: string | null;
  latestEventAt?: string | null;
  followUpCreated: boolean;
};

const tabRanges = {
  Companies: "A:I",
  Contacts: "A:H",
  Drafts: "A:I",
  "LinkedIn Tasks": "A:E",
  Engagement: "A:D",
} as const;

export function buildCompanySheetRow(input: CompanySheetRowInput) {
  return [
    input.companyId,
    input.companyName,
    input.industry ?? "",
    input.locationSummary ?? "",
    input.website ?? "",
    input.phone ?? "",
    input.status,
    input.scoreLabel,
    input.leadUrl,
  ];
}

export function buildContactSheetRow(input: ContactSheetRowInput) {
  return [
    input.draftId,
    input.companyName,
    input.contactName ?? "",
    input.contactTitle ?? "",
    input.contactEmail ?? "",
    input.contactPhone ?? "",
    input.confidenceLabel ?? "",
    input.leadUrl,
  ];
}

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

export function buildLinkedInTaskSheetRow(input: LinkedInSheetRowInput) {
  return [
    input.draftId,
    input.contactName ?? "",
    input.lookupStatus,
    input.profileUrl ?? "",
    input.connectionRequestNote,
  ];
}

export function buildEngagementSheetRow(input: EngagementSheetRowInput) {
  return [
    input.draftId,
    input.latestEventType ?? "",
    input.latestEventAt ?? "",
    input.followUpCreated ? "yes" : "no",
  ];
}

export function extractSheetRowKey(updatedRange?: string | null) {
  const match = updatedRange?.match(/![A-Z]+(\d+):/i);
  return match?.[1] ?? null;
}

async function ensureGoogleSheetTab(input: {
  auth: unknown;
  spreadsheetId: string;
  tabName: keyof typeof tabRanges;
}) {
  const sheets = google.sheets({ version: "v4", auth: input.auth as never });
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: input.spreadsheetId,
    fields: "sheets.properties.title",
  });

  const existing = new Set(
    metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean),
  );

  if (existing.has(input.tabName)) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: input.tabName,
            },
          },
        },
      ],
    },
  });
}

export async function upsertGoogleSheetRow(input: {
  auth: unknown;
  spreadsheetId: string;
  tabName: keyof typeof tabRanges;
  row: string[];
  rowKey?: string | null;
}) {
  const sheets = google.sheets({ version: "v4", auth: input.auth as never });
  await ensureGoogleSheetTab({
    auth: input.auth,
    spreadsheetId: input.spreadsheetId,
    tabName: input.tabName,
  });
  const range = `${input.tabName}!${tabRanges[input.tabName]}`;

  if (input.rowKey) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: input.spreadsheetId,
      range: `${input.tabName}!A${input.rowKey}:${String.fromCharCode(64 + input.row.length)}${input.rowKey}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [input.row],
      },
    });

    return {
      rowKey: input.rowKey,
      updatedRange: `${input.tabName}!A${input.rowKey}:${String.fromCharCode(64 + input.row.length)}${input.rowKey}`,
    };
  }

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: input.spreadsheetId,
    range,
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

export async function upsertGoogleSheetDraftRow(
  input: Omit<Parameters<typeof upsertGoogleSheetRow>[0], "tabName">,
) {
  return upsertGoogleSheetRow({
    ...input,
    tabName: "Drafts",
  });
}
