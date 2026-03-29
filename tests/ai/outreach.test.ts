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

  it("can frame a short diagnostic form as a friction-light CTA", () => {
    const draft = buildOutreachDraft({
      companyName: "Burger Huyser Attorneys",
      contactName: "Megan",
      pain: "slow intake and follow-up",
      leadMagnetTitle: "Law Intake Bottleneck Snapshot",
      serviceAngle: "improve intake handoff and response speed",
      diagnosticFormCta: {
        mode: "form_only",
        short: "I put together a short 2-minute workflow diagnostic for law firms.",
        medium:
          "I made a quick bottleneck assessment form tailored to firms that want to tighten intake and response speed.",
      },
    });

    expect(draft.cold_email_short).toMatch(/2-minute workflow diagnostic/i);
    expect(draft.cold_email_medium).toMatch(/bottleneck assessment form/i);
  });
});
