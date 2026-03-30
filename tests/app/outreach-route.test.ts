export {};

const findCompany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: findCompany,
    },
  },
}));

describe("lead outreach route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("surfaces the Apollo plan restriction when no contact emails are available", async () => {
    findCompany.mockResolvedValueOnce({
      id: "company-1",
      name: "Adams & Adams",
      contacts: [],
      painHypotheses: [
        {
          id: "pain-1",
          primaryPain: "Operational complexity",
          recommendedServiceAngle: "Content operations",
        },
      ],
      leadMagnets: [
        {
          id: "magnet-1",
          title: "Operations audit",
          summary: "Summary",
          whyItMatchesTheLead: "Why",
          suggestedDeliveryFormat: "PDF",
        },
      ],
      diagnosticForms: [],
      enrichmentJobs: [
        {
          stage: "APOLLO_PEOPLE_ENRICHMENT",
          lastError: "Apollo people search is unavailable for the current Apollo API plan.",
          resultSummary: {
            warnings: ["Apollo people search is unavailable for the current Apollo API plan."],
          },
        },
      ],
    });

    const { POST } = await import("@/app/api/leads/[id]/outreach/route");
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ id: "company-1" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Apollo people search is unavailable for the current Apollo API plan.",
    });
  });
});
