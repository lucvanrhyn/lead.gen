import {
  buildFallbackBusinessContext,
  businessContextSchema,
  extractBusinessContext,
} from "@/lib/ai/business-context";

describe("businessContextSchema", () => {
  it("validates a valid business context payload", () => {
    const parsed = businessContextSchema.parse({
      website_summary: "Acme Co provides cloud-based accounting software for small businesses.",
      services_offerings: ["Invoicing", "Payroll", "Tax filing"],
      customer_type: "b2b",
      weak_lead_capture_signals: ["No contact form found on the homepage"],
      operational_clues: ["References a manual approval workflow for expense reports"],
      urgency_signals: ["Hiring page lists 5 open engineering roles"],
      decision_maker_clues: ["Founder photo and bio prominently featured on About page"],
      tone_brand_clues: ["Professional tone with corporate language throughout"],
    });

    expect(parsed.customer_type).toBe("b2b");
    expect(parsed.services_offerings).toHaveLength(3);
    expect(parsed.website_summary).toMatch(/accounting/i);
  });

  it("rejects an invalid customer_type value", () => {
    expect(() =>
      businessContextSchema.parse({
        website_summary: "Some company.",
        services_offerings: [],
        customer_type: "enterprise",
        weak_lead_capture_signals: [],
        operational_clues: [],
        urgency_signals: [],
        decision_maker_clues: [],
        tone_brand_clues: [],
      }),
    ).toThrow();
  });
});

describe("extractBusinessContext", () => {
  it("returns fallback when no crawl pages have markdown", async () => {
    const result = await extractBusinessContext({
      companyName: "Ghost Corp",
      website: "https://ghostcorp.example",
      industry: "software",
      crawlPages: [
        { pageType: "HOMEPAGE", url: "https://ghostcorp.example/", markdown: null },
        { pageType: "ABOUT", url: "https://ghostcorp.example/about", markdown: undefined },
      ],
    });

    const fallback = buildFallbackBusinessContext();
    expect(result).toEqual(fallback);
    expect(result.website_summary).toBe("No crawl data available");
    expect(result.customer_type).toBe("unclear");
    expect(result.services_offerings).toEqual([]);
  });

  it("returns fallback when crawlPages array is empty", async () => {
    const result = await extractBusinessContext({
      companyName: "Empty Corp",
      crawlPages: [],
    });

    expect(result.website_summary).toBe("No crawl data available");
  });

  it("calls OpenAI and parses structured response correctly", async () => {
    const mockPayload = {
      website_summary: "Sunrise Accounting provides bookkeeping services for SMEs in Cape Town.",
      services_offerings: ["Bookkeeping", "VAT returns", "Payroll"],
      customer_type: "b2b",
      weak_lead_capture_signals: ["No live chat widget present"],
      operational_clues: ["Manual quote request form with no automation"],
      urgency_signals: [],
      decision_maker_clues: ["Founder name and photo on homepage"],
      tone_brand_clues: ["Friendly and approachable tone"],
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

    const result = await extractBusinessContext(
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

    expect(result.website_summary).toMatch(/bookkeeping/i);
    expect(result.customer_type).toBe("b2b");
    expect(result.services_offerings).toContain("Bookkeeping");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
