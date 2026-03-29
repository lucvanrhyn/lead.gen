import { buildDraftSheetRow, extractSheetRowKey } from "@/lib/providers/google-workspace/sheets";

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
