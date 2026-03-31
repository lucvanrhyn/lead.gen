import { generateReplyDraft, replyDraftSchema } from "@/lib/ai/reply-draft";

describe("replyDraftSchema", () => {
  it("validates a valid reply draft", () => {
    const parsed = replyDraftSchema.parse({
      subject: "Re: Quick idea for Acme Corp",
      body: "Hi Jane, great question. The audit covers the top 3 friction points in your booking funnel. Happy to share it — does this week work for a quick 10-minute call?",
      tone_note: "Kept it concise and action-oriented since the prospect asked a direct question.",
    });

    expect(parsed.subject).toContain("Re:");
    expect(parsed.body.length).toBeGreaterThan(0);
    expect(parsed.tone_note.length).toBeGreaterThan(0);
  });
});

describe("generateReplyDraft", () => {
  it("returns empty result for NOT_INTERESTED without calling OpenAI", async () => {
    const fetchFn = vi.fn();

    const result = await generateReplyDraft(
      {
        classification: "NOT_INTERESTED",
        threadMessages: [
          {
            direction: "INBOUND",
            from: "jane@acmecorp.example.com",
            body: "Not interested, please don't contact me again.",
          },
        ],
        companyName: "Acme Corp",
        originalSubject: "Quick idea for Acme Corp",
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.subject).toBe("");
    expect(result.body).toBe("");
    expect(result.tone_note).toBe("");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls OpenAI for QUESTION_ASKED classification", async () => {
    const mockResponse = {
      subject: "Re: Quick idea for Acme Corp",
      body: "Great question — the audit covers booking funnel friction points specific to your service pages. Happy to send it over today.",
      tone_note: "Direct and helpful tone since the prospect asked a specific question.",
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
                  text: JSON.stringify(mockResponse),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await generateReplyDraft(
      {
        classification: "QUESTION_ASKED",
        threadMessages: [
          {
            direction: "OUTBOUND",
            from: "sales@example.com",
            body: "Hi Jane, I put together a short audit for Acme Corp around booking conversion. Happy to send it over.",
          },
          {
            direction: "INBOUND",
            from: "jane@acmecorp.example.com",
            body: "Thanks, what does the audit cover?",
          },
        ],
        companyName: "Acme Corp",
        originalSubject: "Quick idea for Acme Corp",
        leadMagnetTitle: "Acme Corp Booking Funnel Audit",
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.subject).toContain("Re:");
    expect(result.body.length).toBeGreaterThan(0);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
