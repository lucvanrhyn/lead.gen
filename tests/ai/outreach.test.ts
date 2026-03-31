import {
  buildFollowUpDraft,
  buildLinkedInTask,
  buildOutreachDraft,
  buildOutreachDraftTemplate,
  generateOutreachDraft,
  llmOutreachSchema,
  mapLlmOutreachToOutreachSchema,
} from "@/lib/ai/outreach";

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
      contactName: "Jane Demo",
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

describe("buildOutreachDraftTemplate (renamed function)", () => {
  it("is the same function as the deprecated buildOutreachDraft alias", () => {
    expect(buildOutreachDraftTemplate).toBe(buildOutreachDraft);
  });

  it("produces identical output to the alias", () => {
    const input = {
      companyName: "Test Co",
      pain: "slow onboarding",
      leadMagnetTitle: "Onboarding Teardown",
      serviceAngle: "workflow efficiency",
    };
    expect(buildOutreachDraftTemplate(input)).toEqual(buildOutreachDraft(input));
  });
});

describe("llmOutreachSchema", () => {
  it("accepts a valid LLM output object", () => {
    const valid = {
      subject_lines: ["One subject", "Another subject"],
      primary_email: "Primary email body text.",
      shorter_email_variant: "Short variant.",
      linkedin_message: "LinkedIn message here.",
      follow_up_variants: ["Bump follow-up", "Value-add follow-up"],
      cta: "Happy to send it over if useful.",
      rationale_for_angle: "Chose this angle because of X.",
    };
    expect(() => llmOutreachSchema.parse(valid)).not.toThrow();
  });

  it("rejects when subject_lines has fewer than 2 items", () => {
    const invalid = {
      subject_lines: ["Only one"],
      primary_email: "Body",
      shorter_email_variant: "Short",
      linkedin_message: "LinkedIn",
      follow_up_variants: ["FU1", "FU2"],
      cta: "Reply if useful",
      rationale_for_angle: "Rationale.",
    };
    expect(() => llmOutreachSchema.parse(invalid)).toThrow();
  });

  it("rejects when subject_lines has more than 3 items", () => {
    const invalid = {
      subject_lines: ["S1", "S2", "S3", "S4"],
      primary_email: "Body",
      shorter_email_variant: "Short",
      linkedin_message: "LinkedIn",
      follow_up_variants: ["FU1", "FU2"],
      cta: "Reply if useful",
      rationale_for_angle: "Rationale.",
    };
    expect(() => llmOutreachSchema.parse(invalid)).toThrow();
  });

  it("rejects when follow_up_variants has fewer than 2 items", () => {
    const invalid = {
      subject_lines: ["S1", "S2"],
      primary_email: "Body",
      shorter_email_variant: "Short",
      linkedin_message: "LinkedIn",
      follow_up_variants: ["Only one"],
      cta: "Reply if useful",
      rationale_for_angle: "Rationale.",
    };
    expect(() => llmOutreachSchema.parse(invalid)).toThrow();
  });
});

describe("generateOutreachDraft", () => {
  const MOCK_LLM_OUTPUT = {
    subject_lines: ["Atlas booking gap", "One quick thought"],
    primary_email:
      "I noticed Atlas Dental's treatment pages have a multi-step path before a visitor can book. That friction tends to cut conversion by 20-30%. I put together a short teardown showing exactly where the drop-offs likely occur. Happy to send it over if useful.",
    shorter_email_variant:
      "Short version: spotted a likely booking friction issue at Atlas Dental. I have a short teardown ready — happy to share.",
    linkedin_message:
      "Noticed a likely drop-off in Atlas Dental's booking path. Drafted a short teardown on the gaps — happy to share if that is useful.",
    follow_up_variants: [
      "Bump: just circling back on the Atlas Dental teardown I mentioned.",
      "Value-add: one thing I noticed in the review was that your mobile booking flow has an extra step most visitors abandon.",
    ],
    cta: "Happy to send it over if useful.",
    rationale_for_angle:
      "Atlas Dental's public pages show a treatment-page-to-booking funnel with several steps, making conversion friction the most credible pain to lead with.",
  };

  it("calls the OpenAI API and returns validated LLM output", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(MOCK_LLM_OUTPUT),
      }),
    });

    const result = await generateOutreachDraft(
      {
        companyName: "Atlas Dental Group",
        contactName: "Megan",
        contactTitle: "Practice Manager",
        painHypothesis: {
          primary_pain: "Inconsistent booking conversion across service lines",
          company_summary: "Multi-location dental group in Ontario.",
          best_outreach_angle: "Lead with booking funnel teardown",
          confidence_score: 0.8,
          caution_do_not_claim: ["revenue figures", "patient volume"],
        },
        leadMagnet: {
          title: "Atlas Dental Booking Funnel Teardown",
          type: "teardown",
          suggested_outreach_mention: "mention the treatment page drop-off",
        },
        businessContext: {
          website_summary: "Multi-location dental group with separate pages per service line.",
          services_offerings: ["general dentistry", "orthodontics", "cosmetic dentistry"],
          customer_type: "B2C dental patients",
        },
        leadScore: {
          total_score: 72,
          recommended_action: "send_outreach",
          recommended_channel: "email",
        },
        playbook: {
          messagingFocus: "conversion friction",
          ctaPreferences: ["reply-based", "low-commitment"],
          toneGuidance: "professional but approachable",
          doNotMention: ["competitors", "pricing"],
        },
        diagnosticFormCta: {
          mode: "lead_magnet_and_form",
          short: "Happy to send the teardown.",
          medium: "I have the teardown ready and a short diagnostic form if you want a practical next step.",
        },
      },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.subject_lines).toHaveLength(2);
    expect(result.primary_email).toMatch(/Atlas Dental/i);
    expect(result.cta).toBeTruthy();
    expect(result.rationale_for_angle).toBeTruthy();
  });

  it("includes all non-null sections in the user content sent to OpenAI", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(MOCK_LLM_OUTPUT),
      }),
    });

    await generateOutreachDraft(
      {
        companyName: "Atlas Dental Group",
        contactName: "Megan",
        painHypothesis: {
          primary_pain: "Booking funnel friction",
          confidence_score: 0.75,
        },
        leadMagnet: {
          title: "Teardown",
          type: "teardown",
        },
        businessContext: null,
        leadScore: null,
        playbook: null,
        diagnosticFormCta: null,
      },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch },
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const userContent: string = callBody.input[1].content;

    expect(userContent).toContain("Atlas Dental Group");
    expect(userContent).toContain("Booking funnel friction");
    expect(userContent).toContain("Teardown");
    expect(userContent).not.toContain("Business Context");
    expect(userContent).not.toContain("Lead Score");
    expect(userContent).not.toContain("Playbook");
    expect(userContent).not.toContain("Diagnostic Form CTA");
  });

  it("uses the OPENAI_MODEL_OUTREACH env key in the request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(MOCK_LLM_OUTPUT),
      }),
    });

    const originalEnv = process.env.OPENAI_MODEL_OUTREACH;
    process.env.OPENAI_MODEL_OUTREACH = "gpt-4o-mini";

    await generateOutreachDraft(
      {
        companyName: "Test Co",
        painHypothesis: { primary_pain: "Some pain", confidence_score: 0.5 },
        leadMagnet: { title: "LM Title", type: "guide" },
      },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch },
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.model).toBe("gpt-4o-mini");

    process.env.OPENAI_MODEL_OUTREACH = originalEnv;
  });
});

describe("mapLlmOutreachToOutreachSchema", () => {
  it("maps all LLM fields to the DB outreach schema columns", () => {
    const llmOutput = {
      subject_lines: ["Subject A", "Subject B"],
      primary_email: "Primary email body.",
      shorter_email_variant: "Short variant.",
      linkedin_message: "LinkedIn message.",
      follow_up_variants: ["Follow-up 1", "Follow-up 2"],
      cta: "Happy to send it over.",
      rationale_for_angle: "Chose this angle because X.",
    };

    const mapped = mapLlmOutreachToOutreachSchema(llmOutput);

    expect(mapped.email_subject_1).toBe("Subject A");
    expect(mapped.email_subject_2).toBe("Subject B");
    expect(mapped.cold_email_short).toBe("Short variant.");
    expect(mapped.cold_email_medium).toBe("Primary email body.");
    expect(mapped.linkedin_message_safe).toBe("LinkedIn message.");
    expect(mapped.follow_up_1).toBe("Follow-up 1");
    expect(mapped.follow_up_2).toBe("Follow-up 2");
  });

  it("falls back email_subject_2 to subject_lines[0] when only two subjects provided", () => {
    const llmOutput = {
      subject_lines: ["Only subject"],
      primary_email: "Body",
      shorter_email_variant: "Short",
      linkedin_message: "LI",
      follow_up_variants: ["FU1", "FU2"],
      cta: "Reply if useful",
      rationale_for_angle: "Rationale.",
    };

    // llmOutreachSchema will reject this (min 2), but the mapper itself should handle it
    // Test it directly by bypassing schema parse
    const rawOutput = llmOutput as unknown as typeof llmOutput & { subject_lines: string[] };
    const mapped = mapLlmOutreachToOutreachSchema(rawOutput as Parameters<typeof mapLlmOutreachToOutreachSchema>[0]);

    expect(mapped.email_subject_1).toBe("Only subject");
    expect(mapped.email_subject_2).toBe("Only subject");
  });

  it("falls back follow_up_1 and follow_up_2 to empty strings when variants are missing", () => {
    const llmOutput = {
      subject_lines: ["S1", "S2"],
      primary_email: "Body",
      shorter_email_variant: "Short",
      linkedin_message: "LI",
      follow_up_variants: [] as string[],
      cta: "CTA",
      rationale_for_angle: "Rationale.",
    };

    // Bypass Zod schema validation to test the mapper's fallback logic directly
    const mapped = mapLlmOutreachToOutreachSchema(
      llmOutput as Parameters<typeof mapLlmOutreachToOutreachSchema>[0],
    );

    expect(mapped.follow_up_1).toBe("");
    expect(mapped.follow_up_2).toBe("");
  });
});
