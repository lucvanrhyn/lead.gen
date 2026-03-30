import {
  enrichApolloCompanyAndContacts,
  normalizeApolloOrganization,
} from "@/lib/providers/apollo/client";

describe("normalizeApolloOrganization", () => {
  it("maps Apollo organization fields into the internal company shape", () => {
    const normalized = normalizeApolloOrganization({
      organization: {
        id: "apollo-org-1",
        name: "Atlas Dental Group",
        website_url: "https://demo-dental.invalid",
        phone: "+1 555 000 0000",
        primary_domain: "demo-dental.invalid",
        industry: "Hospital & Health Care",
        estimated_num_employees: 48,
        short_description: "Multi-location dental clinics.",
        city: "Cape Town",
        country: "South Africa",
      },
    });

    expect(normalized).toMatchObject({
      apolloOrganizationId: "apollo-org-1",
      name: "Atlas Dental Group",
      website: "https://demo-dental.invalid",
      industry: "Hospital & Health Care",
      employeeCount: 48,
      phone: "+1 555 000 0000",
    });
  });
});

describe("enrichApolloCompanyAndContacts", () => {
  it("throws when the Apollo API key is missing", async () => {
    await expect(
      enrichApolloCompanyAndContacts(
        {
          domain: "demo-dental.invalid",
        },
        {
          apiKey: "",
          fetchFn: vi.fn(),
        },
      ),
    ).rejects.toThrow(/apollo api key/i);
  });

  it("enriches a company and returns decision-maker candidates", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organization: {
              id: "apollo-org-1",
              name: "Atlas Dental Group",
              website_url: "https://demo-dental.invalid",
              industry: "Hospital & Health Care",
              estimated_num_employees: 48,
              city: "Cape Town",
              country: "South Africa",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            people: [
              {
                id: "apollo-person-1",
                first_name: "Megan",
                last_name: "Jacobs",
                name: "Jane Demo",
                title: "Practice Manager",
                seniority: "manager",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            people: [
              {
                id: "apollo-person-1",
                first_name: "Megan",
                last_name: "Jacobs",
                name: "Jane Demo",
                title: "Practice Manager",
                email: "jane@demo-dental.invalid",
                phone_numbers: [{ raw_number: "+1 555 000 0000" }],
                departments: ["operations"],
                seniority: "manager",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await enrichApolloCompanyAndContacts(
      {
        domain: "demo-dental.invalid",
        companyName: "Atlas Dental Group",
      },
      {
        apiKey: "apollo_test_key",
        fetchFn,
      },
    );

    expect(result.company.apolloOrganizationId).toBe("apollo-org-1");
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toMatchObject({
      apolloPersonId: "apollo-person-1",
      fullName: "Jane Demo",
      email: "jane@demo-dental.invalid",
    });
  });

  it("returns company enrichment and no contacts when people search is inaccessible on the current Apollo plan", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organization: {
              id: "apollo-org-1",
              name: "Atlas Dental Group",
              website_url: "https://demo-dental.invalid",
              industry: "Hospital & Health Care",
              estimated_num_employees: 48,
              city: "Cape Town",
              country: "South Africa",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error:
              "api/v1/mixed_people/api_search is not accessible with this api_key on a free plan.",
            error_code: "API_INACCESSIBLE",
          }),
          { status: 403 },
        ),
      );

    const result = await enrichApolloCompanyAndContacts(
      {
        domain: "demo-dental.invalid",
        companyName: "Atlas Dental Group",
      },
      {
        apiKey: "apollo_test_key",
        fetchFn,
      },
    );

    expect(result.company.apolloOrganizationId).toBe("apollo-org-1");
    expect(result.contacts).toEqual([]);
    expect(result.warnings).toContain(
      "Apollo people search is unavailable for the current Apollo API plan.",
    );
  });
});
