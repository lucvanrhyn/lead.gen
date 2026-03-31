import { qaCheckSchema, runQaCheck } from "@/lib/ai/qa-check";

describe("qaCheckSchema", () => {
  it("validates a passing QA result with empty issues and empty revised_fields", () => {
    const result = qaCheckSchema.parse({
      passed: true,
      issues: [],
      revised_fields: {},
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.revised_fields).toEqual({});
  });

  it("validates a failing QA result with issues and revised_fields", () => {
    const result = qaCheckSchema.parse({
      passed: false,
      issues: [
        {
          field: "cold_email_medium",
          issue_type: "spammy_language",
          description: "Uses the phrase 'game-changer' which is flagged as spammy.",
          severity: "blocker",
          suggested_fix: "Replace 'game-changer' with a specific benefit statement.",
        },
        {
          field: "email_subject_1",
          issue_type: "too_long",
          description: "Subject line exceeds 50 characters.",
          severity: "warning",
          suggested_fix: "",
        },
      ],
      revised_fields: {
        cold_email_medium: "We help dental practices improve booking conversion by 20%.",
      },
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].issue_type).toBe("spammy_language");
    expect(result.issues[0].severity).toBe("blocker");
    expect(result.issues[1].severity).toBe("warning");
    expect(result.revised_fields["cold_email_medium"]).toContain("booking conversion");
  });
});

describe("runQaCheck", () => {
  const sampleDraft = {
    emailSubject1: "A quick thought on Atlas Dental bookings",
    emailSubject2: "Booking gap at Atlas Dental",
    coldEmailShort: "Jane, I put together a short teardown on how Atlas Dental could tighten the path from treatment-page visits to booked consults.",
    coldEmailMedium: "Jane, I reviewed Atlas Dental's website and noticed the treatment pages get traffic but the booking path has friction. I put together a short funnel teardown focused on that. Happy to send it over if useful.",
    linkedinMessageSafe: "I put together a short booking funnel teardown for Atlas Dental. Happy to share if helpful.",
    followUp1: "Following up in case the booking funnel teardown would be useful for Atlas Dental.",
    followUp2: "Happy to send the short version if improving booking conversion is on your radar.",
  };

  const sampleInput = {
    outreachDraft: sampleDraft,
    companyName: "Atlas Dental Group",
    contactName: "Jane",
    painHypothesis: {
      primary_pain: "Low online booking conversion rate",
      company_summary: "Multi-location dental group with treatment-specific landing pages.",
      confidence_score: 0.78,
      caution_do_not_claim: ["exact revenue figures", "specific staff count"],
    },
    businessContext: {
      website_summary: "Multi-location dental group offering cosmetic and general dentistry.",
      services_offerings: ["cosmetic dentistry", "general dentistry", "orthodontics"],
    },
  };

  it("calls OpenAI and parses the response via fetchFn", async () => {
    const mockPayload = {
      passed: true,
      issues: [],
      revised_fields: {},
    };

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(mockPayload),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await runQaCheck(sampleInput, { apiKey: "test_key", fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns a valid result for a clean draft", async () => {
    const mockPayload = {
      passed: true,
      issues: [],
      revised_fields: {},
    };

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(mockPayload),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await runQaCheck(sampleInput, { apiKey: "test_key", fetchFn });

    const parsed = qaCheckSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.revised_fields).toEqual({});
  });
});
