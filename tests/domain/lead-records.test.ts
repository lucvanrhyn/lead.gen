import {
  companySeedGraphSchema,
  defaultEnrichmentStages,
} from "@/lib/domain/lead-records";

describe("companySeedGraphSchema", () => {
  it("accepts a seed graph with source attribution and contacts", () => {
    const parsed = companySeedGraphSchema.parse({
      company: {
        name: "Atlas Dental Group",
        website: "https://atlasdental.co.za",
        industry: "Dental Clinics",
        location: "Cape Town, South Africa",
      },
      contacts: [
        {
          fullName: "Megan Jacobs",
          title: "Practice Manager",
          email: "megan@atlasdental.co.za",
        },
      ],
      sourceEvent: {
        provider: "manual_seed",
        url: "https://atlasdental.co.za",
        confidence: 0.92,
      },
    });

    expect(parsed.company.name).toBe("Atlas Dental Group");
    expect(parsed.contacts).toHaveLength(1);
  });
});

describe("defaultEnrichmentStages", () => {
  it("keeps Apollo as the primary enrichment stage after discovery", () => {
    expect(defaultEnrichmentStages).toEqual([
      "google_places_discovery",
      "apollo_company_enrichment",
      "apollo_people_enrichment",
      "firecrawl_extraction",
      "pain_hypothesis_generation",
    ]);
  });
});
