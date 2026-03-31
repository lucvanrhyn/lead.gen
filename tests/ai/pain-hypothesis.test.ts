import {
  buildInsufficientEvidencePainHypothesis,
  generatePainHypothesis,
  painHypothesisSchema,
} from "@/lib/ai/pain-hypothesis";

const VALID_PAIN_HYPOTHESIS_PAYLOAD = {
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
  company_summary: "A dental practice offering cosmetic and general dentistry services.",
  observed_signals: [
    {
      signal: "No online booking form visible on contact page",
      source: "https://demo-dental.invalid/contact",
      confidence: 0.85,
      category: "observed" as const,
    },
    {
      signal: "Likely losing bookings due to phone-only contact",
      source: "https://demo-dental.invalid/contact",
      confidence: 0.65,
      category: "inferred" as const,
    },
  ],
  likely_pains: [
    {
      pain: "Friction in booking flow reduces conversions",
      category: "inferred" as const,
      evidence_refs: ["No online booking form visible on contact page"],
    },
    {
      pain: "May be experiencing missed after-hours inquiries",
      category: "speculative" as const,
      evidence_refs: [],
    },
  ],
  best_outreach_angle: "Show how adding an online booking form could recover lost high-value appointments",
  caution_do_not_claim: [
    "Likely losing bookings due to phone-only contact",
    "May be experiencing missed after-hours inquiries",
  ],
};

describe("painHypothesisSchema", () => {
  it("accepts a valid strict pain hypothesis payload", () => {
    const parsed = painHypothesisSchema.parse(VALID_PAIN_HYPOTHESIS_PAYLOAD);

    expect(parsed.primary_pain).toMatch(/booking conversion/i);
  });

  it("validates new structured fields", () => {
    const parsed = painHypothesisSchema.parse(VALID_PAIN_HYPOTHESIS_PAYLOAD);

    expect(parsed.company_summary).toBeTruthy();
    expect(parsed.observed_signals).toHaveLength(2);
    expect(parsed.observed_signals[0].category).toBe("observed");
    expect(parsed.observed_signals[1].category).toBe("inferred");
    expect(parsed.likely_pains).toHaveLength(2);
    expect(parsed.likely_pains[0].category).toBe("inferred");
    expect(parsed.likely_pains[1].category).toBe("speculative");
    expect(parsed.best_outreach_angle).toBeTruthy();
    expect(parsed.caution_do_not_claim).toHaveLength(2);
  });

  it("rejects invalid category values in observed_signals", () => {
    const invalid = {
      ...VALID_PAIN_HYPOTHESIS_PAYLOAD,
      observed_signals: [
        {
          signal: "test",
          source: "https://example.invalid",
          confidence: 0.5,
          category: "unknown",
        },
      ],
    };

    expect(() => painHypothesisSchema.parse(invalid)).toThrow();
  });
});

describe("buildInsufficientEvidencePainHypothesis", () => {
  it("returns an explicit insufficient-evidence payload", () => {
    const result = buildInsufficientEvidencePainHypothesis("Atlas Dental Group");

    expect(result.insufficient_evidence).toBe(true);
    expect(result.evidence).toEqual([]);
    expect(result.primary_pain).toMatch(/insufficient public evidence/i);
  });

  it("returns correct defaults for new fields", () => {
    const result = buildInsufficientEvidencePainHypothesis("Atlas Dental Group");

    expect(result.company_summary).toMatch(/Atlas Dental Group/);
    expect(result.observed_signals).toEqual([]);
    expect(result.likely_pains).toEqual([]);
    expect(result.best_outreach_angle).toMatch(/gather more evidence/i);
    expect(result.caution_do_not_claim).toHaveLength(1);
    expect(result.caution_do_not_claim[0]).toMatch(/insufficient evidence/i);
  });
});

function makeMockResponse(payload: object) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(payload),
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
}

const MOCK_API_RESPONSE_PAYLOAD = {
  primary_pain: "Need to differentiate in a competitive legal market",
  secondary_pains: [],
  evidence: [],
  business_impact: "Weak differentiation can suppress qualified inbound enquiries.",
  confidence_score: 0.54,
  recommended_service_angle: "Sharpen practice-area positioning and enquiry flow.",
  recommended_lead_magnet_type: "positioning audit",
  insufficient_evidence: true,
  company_summary: "A law firm offering specialist legal services in Johannesburg.",
  observed_signals: [
    {
      signal: "Generic homepage copy with no differentiating claims",
      source: "http://www.burgerhuyserattorneys.co.za/",
      confidence: 0.6,
      category: "observed",
    },
  ],
  likely_pains: [
    {
      pain: "Likely struggling to stand out from competing firms",
      category: "inferred",
      evidence_refs: ["Generic homepage copy with no differentiating claims"],
    },
  ],
  best_outreach_angle: "Offer a practice-area positioning teardown to help them attract more qualified leads.",
  caution_do_not_claim: ["Likely struggling to stand out from competing firms"],
};

describe("generatePainHypothesis", () => {
  it("parses structured output from response message content text", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(MOCK_API_RESPONSE_PAYLOAD));

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
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.primary_pain).toMatch(/differentiate/i);
  });

  it("returns new structured fields in parsed output", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(MOCK_API_RESPONSE_PAYLOAD));

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
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.company_summary).toBeTruthy();
    expect(result.observed_signals).toHaveLength(1);
    expect(result.likely_pains).toHaveLength(1);
    expect(result.best_outreach_angle).toBeTruthy();
    expect(result.caution_do_not_claim).toHaveLength(1);
  });

  it("injects business context into user content when provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(MOCK_API_RESPONSE_PAYLOAD));

    await generatePainHypothesis(
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
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
        businessContext: {
          website_summary: "A law firm in Johannesburg.",
          services_offerings: ["litigation", "conveyancing"],
          customer_type: "b2b",
          urgency_signals: ["hiring notice on homepage"],
        },
      },
    );

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    const userContent = body.input.find((m: { role: string }) => m.role === "user").content;

    expect(userContent).toMatch(/Business context \(pre-extracted\)/);
    expect(userContent).toMatch(/A law firm in Johannesburg\./);
    expect(userContent).toMatch(/litigation/);
    expect(userContent).toMatch(/hiring notice on homepage/);
  });

  it("injects playbook context into user content when provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(MOCK_API_RESPONSE_PAYLOAD));

    await generatePainHypothesis(
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
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
        playbook: {
          commonPains: ["low client retention", "poor online visibility"],
          offerAngles: ["positioning audit", "referral system"],
          messagingFocus: "Trust and credibility building",
        },
      },
    );

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    const userContent = body.input.find((m: { role: string }) => m.role === "user").content;

    expect(userContent).toMatch(/Industry playbook context/);
    expect(userContent).toMatch(/low client retention/);
    expect(userContent).toMatch(/Trust and credibility building/);
  });

  it("returns insufficient evidence payload when no crawl pages have markdown", async () => {
    const fetchFn = vi.fn();

    const result = await generatePainHypothesis(
      {
        companyName: "Empty Corp",
        crawlPages: [{ pageType: "HOMEPAGE", url: "https://empty.invalid", markdown: null }],
      },
      { apiKey: "openai_test_key", fetchFn },
    );

    expect(result.insufficient_evidence).toBe(true);
    expect(result.company_summary).toMatch(/Empty Corp/);
    expect(result.observed_signals).toEqual([]);
    expect(result.caution_do_not_claim).toHaveLength(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
