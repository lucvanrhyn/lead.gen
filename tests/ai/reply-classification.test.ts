import { classifyReply, replyClassificationSchema } from "@/lib/ai/reply-classification";

describe("replyClassificationSchema", () => {
  it("validates a valid classification result", () => {
    const parsed = replyClassificationSchema.parse({
      classification: "INTERESTED",
      confidence: 0.92,
      summary: "The prospect asked for more details about the service.",
      suggested_action: "Send the lead magnet and propose a 15-minute call.",
      should_stop_follow_ups: false,
    });

    expect(parsed.classification).toBe("INTERESTED");
    expect(parsed.confidence).toBe(0.92);
    expect(parsed.should_stop_follow_ups).toBe(false);
  });

  it("rejects invalid classification values", () => {
    expect(() =>
      replyClassificationSchema.parse({
        classification: "UNKNOWN_TYPE",
        confidence: 0.5,
        summary: "Some summary.",
        suggested_action: "Do something.",
        should_stop_follow_ups: false,
      }),
    ).toThrow();
  });
});

describe("classifyReply", () => {
  it("returns a parsed classification result from mocked fetch", async () => {
    const mockResponse = {
      classification: "QUESTION_ASKED",
      confidence: 0.88,
      summary: "The prospect asked what the lead magnet contains.",
      suggested_action: "Answer the question directly and offer to send the asset.",
      should_stop_follow_ups: false,
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

    const result = await classifyReply(
      {
        threadMessages: [
          {
            direction: "OUTBOUND",
            from: "sales@example.com",
            subject: "Quick idea for Acme Corp",
            body: "Hi Jane, I put together a short audit for Acme Corp around booking conversion. Happy to send it over.",
            sentAt: "2026-03-28T10:00:00Z",
          },
          {
            direction: "INBOUND",
            from: "jane@acmecorp.example.com",
            subject: "Re: Quick idea for Acme Corp",
            body: "Thanks, what does the audit actually cover?",
            sentAt: "2026-03-28T14:30:00Z",
          },
        ],
        originalSubject: "Quick idea for Acme Corp",
        companyName: "Acme Corp",
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.classification).toBe("QUESTION_ASKED");
    expect(result.confidence).toBe(0.88);
    expect(result.should_stop_follow_ups).toBe(false);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
