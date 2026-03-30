import {
  buildInsufficientEvidencePainHypothesis,
  generatePainHypothesis,
  painHypothesisSchema,
} from "@/lib/ai/pain-hypothesis";

describe("painHypothesisSchema", () => {
  it("accepts a valid strict pain hypothesis payload", () => {
    const parsed = painHypothesisSchema.parse({
      primary_pain: "Inconsistent booking conversion across service lines",
      secondary_pains: ["High-value treatment pages may underperform"],
      evidence: [
        {
          source_type: "website",
          source_url: "https://demo-dental.invalid",
          snippet: "same-week bookings and cosmetic smile packages",
          signal_type: "conversion_signal",
          confidence: 0.78,
        },
      ],
      business_impact: "Missed conversion opportunities likely reduce high-margin treatment bookings.",
      confidence_score: 0.72,
      recommended_service_angle: "Conversion-focused website teardown for treatment pages",
      recommended_lead_magnet_type: "website conversion teardown",
      insufficient_evidence: false,
    });

    expect(parsed.primary_pain).toMatch(/booking conversion/i);
  });
});

describe("buildInsufficientEvidencePainHypothesis", () => {
  it("returns an explicit insufficient-evidence payload", () => {
    const result = buildInsufficientEvidencePainHypothesis("Atlas Dental Group");

    expect(result.insufficient_evidence).toBe(true);
    expect(result.evidence).toEqual([]);
    expect(result.primary_pain).toMatch(/insufficient public evidence/i);
  });
});

describe("generatePainHypothesis", () => {
  it("parses structured output from response message content text", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    primary_pain: "Need to differentiate in a competitive legal market",
                    secondary_pains: [],
                    evidence: [],
                    business_impact: "Weak differentiation can suppress qualified inbound enquiries.",
                    confidence_score: 0.54,
                    recommended_service_angle: "Sharpen practice-area positioning and enquiry flow.",
                    recommended_lead_magnet_type: "positioning audit",
                    insufficient_evidence: true,
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await generatePainHypothesis(
      {
        companyName: "Burger Huyser Attorneys",
        website: "http://www.burgerhuyserattorneys.co.za",
        industry: "law practice",
        crawlPages: [
          {
            pageType: "HOMEPAGE",
            url: "http://www.burgerhuyserattorneys.co.za/",
            markdown: "Top Law Firms In Johannesburg | Specialist Lawyers | Burger Huyser",
          },
        ],
        technologyProfiles: [],
        newsMentions: [],
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.primary_pain).toMatch(/differentiate/i);
  });
});
