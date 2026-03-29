import {
  buildCompanySheetRow,
  buildDraftSheetRow,
  buildEngagementSheetRow,
  extractSheetRowKey,
} from "@/lib/providers/google-workspace/sheets";

describe("buildDraftSheetRow", () => {
  it("creates a company-contact-outreach row for the Drafts tab", () => {
    const row = buildDraftSheetRow({
      draftId: "draft-1",
      companyName: "Atlas Dental Group",
      contactName: "Megan Jacobs",
      contactEmail: "megan@atlasdental.co.za",
      approvalStatus: "APPROVED",
      emailSubject: "A quick idea for Atlas Dental bookings",
      gmailSyncStatus: "READY",
      sheetSyncStatus: "NOT_READY",
      leadUrl: "http://localhost:3000/leads/lead-1",
    });

    expect(row).toContain("Atlas Dental Group");
    expect(row).toContain("Megan Jacobs");
    expect(row).toContain("APPROVED");
  });
});

describe("extractSheetRowKey", () => {
  it("returns the appended row number from the updated range", () => {
    expect(extractSheetRowKey("Drafts!A12:J12")).toBe("12");
  });
});

describe("buildCompanySheetRow", () => {
  it("creates a company ledger row", () => {
    const row = buildCompanySheetRow({
      companyId: "company-1",
      companyName: "Atlas Dental Group",
      industry: "Dental Clinics",
      locationSummary: "Cape Town, South Africa",
      website: "https://atlasdental.co.za",
      phone: "+27 21 555 0133",
      status: "READY",
      scoreLabel: "79 / 100",
      leadUrl: "http://localhost:3000/leads/company-1",
    });

    expect(row).toContain("Atlas Dental Group");
    expect(row).toContain("Dental Clinics");
    expect(row).toContain("79 / 100");
  });
});

describe("buildEngagementSheetRow", () => {
  it("creates an engagement ledger row with the latest event summary", () => {
    const row = buildEngagementSheetRow({
      draftId: "draft-1",
      latestEventType: "CLICK",
      latestEventAt: "2026-03-29 15:40",
      followUpCreated: true,
    });

    expect(row).toContain("CLICK");
    expect(row).toContain("2026-03-29 15:40");
    expect(row).toContain("yes");
  });
});
