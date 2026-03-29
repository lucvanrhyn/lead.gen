import { buildOutreachDraft } from "@/lib/ai/outreach";

describe("buildOutreachDraft", () => {
  it("creates a safe outreach bundle from company and pain context", () => {
    const draft = buildOutreachDraft({
      companyName: "Atlas Dental Group",
      contactName: "Megan",
      pain: "Inconsistent booking conversion across service lines",
      leadMagnetTitle: "Atlas Dental Booking Funnel Teardown",
      serviceAngle: "Conversion-focused website teardown for treatment pages",
    });

    expect(draft.email_subject_1).toMatch(/Atlas Dental/i);
    expect(draft.cold_email_short).toMatch(/Booking Funnel Teardown/i);
  });
});
