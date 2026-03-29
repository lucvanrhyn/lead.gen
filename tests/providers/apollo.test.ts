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
        website_url: "https://atlasdental.co.za",
        phone: "+27 21 555 0133",
        primary_domain: "atlasdental.co.za",
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
      website: "https://atlasdental.co.za",
      industry: "Hospital & Health Care",
      employeeCount: 48,
      phone: "+27 21 555 0133",
    });
  });
});

describe("enrichApolloCompanyAndContacts", () => {
  it("throws when the Apollo API key is missing", async () => {
    await expect(
      enrichApolloCompanyAndContacts(
        {
          domain: "atlasdental.co.za",
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
              website_url: "https://atlasdental.co.za",
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
                name: "Megan Jacobs",
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
                name: "Megan Jacobs",
                title: "Practice Manager",
                email: "megan@atlasdental.co.za",
                phone_numbers: [{ raw_number: "+27 21 555 0133" }],
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
        domain: "atlasdental.co.za",
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
      fullName: "Megan Jacobs",
      email: "megan@atlasdental.co.za",
    });
  });
});
