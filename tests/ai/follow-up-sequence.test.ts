import {
  followUpContentSchema,
  generateFollowUpContent,
} from "@/lib/ai/follow-up-sequence";

describe("followUpContentSchema", () => {
  it("validates a valid follow-up content object", () => {
    const valid = {
      subject: "Quick thought on the Atlas teardown",
      email_body: "Still happy to send the Atlas Dental booking teardown over — just say the word.",
      linkedin_message: "Happy to share the Atlas teardown if timing is better now.",
      angle: "bump",
      rationale: "A short bump keeps the thread alive without adding pressure.",
    };

    expect(() => followUpContentSchema.parse(valid)).not.toThrow();
    const parsed = followUpContentSchema.parse(valid);
    expect(parsed.angle).toBe("bump");
  });

  it("rejects an invalid angle value", () => {
    const invalid = {
      subject: "Re: Atlas teardown",
      email_body: "Body text here.",
      linkedin_message: "Short LinkedIn message.",
      angle: "aggressive_follow_up",
      rationale: "Some rationale.",
    };

    expect(() => followUpContentSchema.parse(invalid)).toThrow();
  });

  it("accepts all valid angle values", () => {
    const angles = ["bump", "value_add", "question", "soft_close"] as const;

    for (const angle of angles) {
      const valid = {
        subject: "Re: something",
        email_body: "Body",
        linkedin_message: "LI message",
        angle,
        rationale: "Rationale",
      };
      expect(() => followUpContentSchema.parse(valid)).not.toThrow();
    }
  });
});

describe("generateFollowUpContent", () => {
  const MOCK_RESPONSE = {
    subject: "Re: Atlas booking teardown",
    email_body: "Still happy to send it over — the teardown is ready whenever you are.",
    linkedin_message: "Happy to share the teardown if timing is better now.",
    angle: "bump",
    rationale: "A gentle bump referencing the original offer keeps the thread warm.",
  };

  it("calls OpenAI with the correct angle in the user content", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(MOCK_RESPONSE) }),
    });

    const result = await generateFollowUpContent(
      {
        sequenceStep: 2,
        companyName: "Atlas Dental Group",
        contactName: "Megan",
        originalSubject: "Atlas Dental Booking Funnel Teardown",
        originalEmailBody: "I noticed Atlas Dental's treatment pages have a multi-step path...",
        painHypothesis: {
          primary_pain: "Inconsistent booking conversion",
          recommended_service_angle: "Conversion-focused teardown",
        },
        leadMagnetTitle: "Atlas Dental Booking Funnel Teardown",
        angle: "bump",
      },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(mockFetch).toHaveBeenCalledOnce();

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const userContent: string = callBody.input[1].content;

    expect(userContent).toContain("Atlas Dental Group");
    expect(userContent).toContain("bump");
    expect(userContent).toContain("Megan");
    expect(result.angle).toBe("bump");
    expect(result.subject).toBeTruthy();
  });

  it("uses the OPENAI_MODEL_OUTREACH env key", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(MOCK_RESPONSE) }),
    });

    const originalEnv = process.env.OPENAI_MODEL_OUTREACH;
    process.env.OPENAI_MODEL_OUTREACH = "gpt-4o-mini";

    await generateFollowUpContent(
      {
        sequenceStep: 3,
        companyName: "Test Co",
        originalSubject: "Re: your outreach",
        originalEmailBody: "Original email body here.",
        painHypothesis: {
          primary_pain: "Growth challenges",
          recommended_service_angle: "Efficiency",
        },
        leadMagnetTitle: "Resource",
        angle: "value_add",
      },
      { apiKey: "test-key", fetchFn: mockFetch as unknown as typeof fetch },
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.model).toBe("gpt-4o-mini");

    process.env.OPENAI_MODEL_OUTREACH = originalEnv;
  });
});
