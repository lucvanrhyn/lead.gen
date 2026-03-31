import {
  businessContextAndPainSchema,
  extractBusinessContextAndPain,
} from "@/lib/ai/business-context-and-pain";
import { buildFallbackBusinessContext } from "@/lib/ai/business-context";
import { buildInsufficientEvidencePainHypothesis } from "@/lib/ai/pain-hypothesis";

const VALID_COMBINED_PAYLOAD = {
  business_context: {
    website_summary: "Sunrise Accounting provides bookkeeping services for SMEs in Cape Town.",
    services_offerings: ["Bookkeeping", "VAT returns", "Payroll"],
    customer_type: "b2b" as const,
    weak_lead_capture_signals: ["No live chat widget present"],
    operational_clues: ["Manual quote request form with no automation"],
    urgency_signals: [],
    decision_maker_clues: ["Founder name and photo on homepage"],
    tone_brand_clues: ["Friendly and approachable tone"],
  },
  pain_hypothesis: {
    primary_pain: "Manual bookkeeping processes causing operational friction",
    secondary_pains: ["No automated invoicing visible"],
    evidence: [
      {
        source_type: "website",
        source_url: "https://sunrise-accounting.example/",
        snippet: "Manual quote request form",
        signal_type: "operational_friction",
        confidence: 0.75,
      },
    ],
    business_impact: "Manual processes likely slow down client onboarding.",
    confidence_score: 0.72,
    recommended_service_angle: "Automate client onboarding to reduce manual effort.",
    recommended_lead_magnet_type: "automation opportunity snapshot",
    insufficient_evidence: false,
    company_summary: "An accounting firm providing bookkeeping services for SMEs in Cape Town.",
    observed_signals: [
      {
        signal: "Manual quote request form with no automation",
        source: "https://sunrise-accounting.example/contact",
        confidence: 0.8,
        category: "observed" as const,
      },
    ],
    likely_pains: [
      {
        pain: "Operational friction from manual client intake",
        category: "inferred" as const,
        evidence_refs: ["Manual quote request form with no automation"],
      },
    ],
    best_outreach_angle: "Show how automating client intake could save hours per week.",
    caution_do_not_claim: ["Operational friction from manual client intake"],
  },
};

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

describe("businessContextAndPainSchema", () => {
  it("validates a valid combined payload", () => {
    const parsed = businessContextAndPainSchema.parse(VALID_COMBINED_PAYLOAD);

    expect(parsed.business_context.customer_type).toBe("b2b");
    expect(parsed.business_context.services_offerings).toHaveLength(3);
    expect(parsed.pain_hypothesis.primary_pain).toMatch(/manual bookkeeping/i);
    expect(parsed.pain_hypothesis.confidence_score).toBe(0.72);
  });

  it("rejects when business_context is missing", () => {
    const { business_context: _, ...withoutBc } = VALID_COMBINED_PAYLOAD;

    expect(() => businessContextAndPainSchema.parse(withoutBc)).toThrow();
  });

  it("rejects when pain_hypothesis is missing", () => {
    const { pain_hypothesis: _, ...withoutPh } = VALID_COMBINED_PAYLOAD;

    expect(() => businessContextAndPainSchema.parse(withoutPh)).toThrow();
  });

  it("rejects invalid nested fields", () => {
    const invalid = {
      ...VALID_COMBINED_PAYLOAD,
      business_context: {
        ...VALID_COMBINED_PAYLOAD.business_context,
        customer_type: "enterprise",
      },
    };

    expect(() => businessContextAndPainSchema.parse(invalid)).toThrow();
  });
});

describe("extractBusinessContextAndPain", () => {
  it("returns fallback when no crawl pages have markdown", async () => {
    const result = await extractBusinessContextAndPain({
      companyName: "Ghost Corp",
      website: "https://ghostcorp.example",
      industry: "software",
      crawlPages: [
        { pageType: "HOMEPAGE", url: "https://ghostcorp.example/", markdown: null },
      ],
    });

    expect(result.business_context).toEqual(buildFallbackBusinessContext());
    expect(result.pain_hypothesis).toEqual(
      buildInsufficientEvidencePainHypothesis("Ghost Corp"),
    );
  });

  it("returns fallback when crawlPages is empty", async () => {
    const result = await extractBusinessContextAndPain({
      companyName: "Empty Corp",
      crawlPages: [],
    });

    expect(result.business_context.website_summary).toBe("No crawl data available");
    expect(result.pain_hypothesis.insufficient_evidence).toBe(true);
  });

  it("calls OpenAI once and parses combined structured response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(VALID_COMBINED_PAYLOAD));

    const result = await extractBusinessContextAndPain(
      {
        companyName: "Sunrise Accounting",
        website: "https://sunrise-accounting.example",
        industry: "accounting",
        crawlPages: [
          {
            pageType: "HOMEPAGE",
            url: "https://sunrise-accounting.example/",
            markdown: "Sunrise Accounting — Expert bookkeeping for small businesses in Cape Town.",
          },
        ],
      },
      { apiKey: "test-key", fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result.business_context.website_summary).toMatch(/bookkeeping/i);
    expect(result.business_context.customer_type).toBe("b2b");
    expect(result.pain_hypothesis.primary_pain).toMatch(/manual bookkeeping/i);
    expect(result.pain_hypothesis.observed_signals).toHaveLength(1);
  });

  it("sends combined schema name in OpenAI request body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(VALID_COMBINED_PAYLOAD));

    await extractBusinessContextAndPain(
      {
        companyName: "Test Co",
        crawlPages: [
          {
            pageType: "HOMEPAGE",
            url: "https://test.example/",
            markdown: "Some page content.",
          },
        ],
      },
      { apiKey: "test-key", fetchFn },
    );

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.text.format.name).toBe("business_context_and_pain");
    expect(body.text.format.schema.properties).toHaveProperty("business_context");
    expect(body.text.format.schema.properties).toHaveProperty("pain_hypothesis");
  });

  it("injects playbook context into user content when provided", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeMockResponse(VALID_COMBINED_PAYLOAD));

    await extractBusinessContextAndPain(
      {
        companyName: "Test Co",
        industry: "accounting",
        crawlPages: [
          {
            pageType: "HOMEPAGE",
            url: "https://test.example/",
            markdown: "Some page content.",
          },
        ],
      },
      {
        apiKey: "test-key",
        fetchFn,
        playbook: {
          commonPains: ["manual reconciliation", "tax deadline stress"],
          offerAngles: ["automation audit", "compliance check"],
          messagingFocus: "Efficiency and accuracy",
        },
      },
    );

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    const userContent = body.input.find((m: { role: string }) => m.role === "user").content;

    expect(userContent).toMatch(/Industry playbook context/);
    expect(userContent).toMatch(/manual reconciliation/);
    expect(userContent).toMatch(/Efficiency and accuracy/);
  });

  it("propagates API errors without swallowing them", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(
      extractBusinessContextAndPain(
        {
          companyName: "Fail Corp",
          crawlPages: [
            {
              pageType: "HOMEPAGE",
              url: "https://fail.example/",
              markdown: "Some content.",
            },
          ],
        },
        { apiKey: "test-key", fetchFn },
      ),
    ).rejects.toThrow(/failed with status 500/);
  });
});
