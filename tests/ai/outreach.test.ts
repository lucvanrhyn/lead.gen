import { buildFollowUpDraft, buildLinkedInTask, buildOutreachDraft } from "@/lib/ai/outreach";

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

  it("creates a manual linkedin task with lookup-needed guidance", () => {
    const task = buildLinkedInTask({
      companyName: "Atlas Dental Group",
      contactName: "Megan Jacobs",
      contactTitle: "Practice Manager",
      leadMagnetTitle: "Atlas Dental Booking Funnel Teardown",
      linkedinMessageSafe:
        "I put together a short teardown on how Atlas Dental could tighten the path from treatment-page visits to booked consults.",
      followUp2: "Happy to send the teardown if improving booking conversion is a priority.",
    });

    expect(task.lookup_status).toBe("MANUAL_LOOKUP_NEEDED");
    expect(task.connection_request_note).toMatch(/Atlas Dental Booking Funnel Teardown/i);
    expect(task.dm_message).toMatch(/treatment-page visits/i);
    expect(task.follow_up_dm).toMatch(/booking conversion/i);
  });

  it("creates a click-aware follow-up draft with a higher-intent angle", () => {
    const followUp = buildFollowUpDraft({
      companyName: "Atlas Dental Group",
      contactName: "Megan",
      leadMagnetTitle: "Atlas Dental Booking Funnel Teardown",
      engagementType: "CLICK",
    });

    expect(followUp.email_subject_1).toMatch(/follow-up/i);
    expect(followUp.cold_email_medium).toMatch(/checked out/i);
    expect(followUp.follow_up_reason).toBe("high_intent_click");
  });
});
