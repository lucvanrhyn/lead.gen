import {
  buildHubSpotCompanySearchPayload,
  buildHubSpotCompanyUpsertPayload,
  buildHubSpotContactSearchPayload,
  buildHubSpotContactUpsertPayload,
  buildHubSpotEngagementNotePayload,
  progressHubSpotDealStage,
  syncOutreachDraftToHubSpot,
  upsertHubSpotDeal,
} from "@/lib/providers/hubspot/client";

function jsonResponse(body: unknown, status = 200) {
  return status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      });
}

describe("hubspot client payload builders", () => {
  it("builds a company search payload that prefers the normalized domain", () => {
    expect(
      buildHubSpotCompanySearchPayload({
        name: "Atlas Dental Group",
        normalizedDomain: "demo-dental.invalid",
      }),
    ).toEqual({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "domain",
              operator: "EQ",
              value: "demo-dental.invalid",
            },
          ],
        },
      ],
      limit: 1,
      properties: ["name", "domain", "website", "phone", "industry"],
    });
  });

  it("builds a company upsert payload with the core CRM fields", () => {
    expect(
      buildHubSpotCompanyUpsertPayload({
        name: "Atlas Dental Group",
        website: "https://demo-dental.invalid",
        normalizedDomain: "demo-dental.invalid",
        phone: "+1 555 000 0000",
        industry: "Dental Clinics",
      }),
    ).toEqual({
      properties: {
        name: "Atlas Dental Group",
        domain: "demo-dental.invalid",
        website: "https://demo-dental.invalid",
        phone: "+1 555 000 0000",
        industry: "Dental Clinics",
      },
    });
  });

  it("builds a contact search payload from email", () => {
    expect(
      buildHubSpotContactSearchPayload({
        email: "jane@demo-dental.invalid",
      }),
    ).toEqual({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: "jane@demo-dental.invalid",
            },
          ],
        },
      ],
      limit: 1,
      properties: ["email", "firstname", "lastname", "jobtitle", "phone"],
    });
  });

  it("builds a contact upsert payload with split names and role details", () => {
    expect(
      buildHubSpotContactUpsertPayload({
        fullName: "Jane Demo",
        email: "jane@demo-dental.invalid",
        title: "Practice Manager",
        phone: "+27 82 555 0199",
      }),
    ).toEqual({
      properties: {
        email: "jane@demo-dental.invalid",
        firstname: "Jane",
        lastname: "Demo",
        jobtitle: "Practice Manager",
        phone: "+27 82 555 0199",
      },
    });
  });

  it("builds a timeline note payload from the latest engagement event", () => {
    const payload = buildHubSpotEngagementNotePayload({
      draft: {
        id: "draft-1",
        emailSubject1: "A quick idea for Atlas Dental bookings",
        draftType: "INITIAL",
        sequenceStep: 1,
      },
      company: {
        id: "company-1",
        name: "Atlas Dental Group",
      },
      contact: {
        id: "contact-1",
        fullName: "Jane Demo",
        email: "jane@demo-dental.invalid",
      },
      event: {
        id: "event-1",
        eventType: "CLICK",
        occurredAt: new Date("2026-03-30T10:15:00.000Z"),
        payload: {
          url: "https://example.com/assets/atlas-demo",
        },
      },
    });

    expect(payload.properties.hs_note_body).toContain("Atlas Dental Group");
    expect(payload.properties.hs_note_body).toContain("Jane Demo");
    expect(payload.properties.hs_note_body).toContain("CLICK");
    expect(payload.properties.hs_note_body).toContain("draft-1");
    expect(payload.properties.hs_note_body).toContain("https://example.com/assets/atlas-demo");
  });
});

describe("syncOutreachDraftToHubSpot", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("upserts company, contact, and a note when HubSpot is configured", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "company-1" }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "contact-1" }))
      .mockResolvedValueOnce(jsonResponse(null, 204))
      .mockResolvedValueOnce(jsonResponse({ id: "note-1" }))
      .mockResolvedValueOnce(jsonResponse(null, 204))
      .mockResolvedValueOnce(jsonResponse(null, 204));

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await syncOutreachDraftToHubSpot(
      {
        company: {
          id: "company-1",
          name: "Atlas Dental Group",
          website: "https://demo-dental.invalid",
          normalizedDomain: "demo-dental.invalid",
          phone: "+1 555 000 0000",
          industry: "Dental Clinics",
        },
        contact: {
          id: "contact-1",
          fullName: "Jane Demo",
          email: "jane@demo-dental.invalid",
          title: "Practice Manager",
          phone: "+27 82 555 0199",
        },
        draft: {
          id: "draft-1",
          emailSubject1: "A quick idea for Atlas Dental bookings",
          draftType: "INITIAL",
          sequenceStep: 1,
        },
        event: {
          id: "event-1",
          eventType: "REPLY",
          occurredAt: new Date("2026-03-30T10:15:00.000Z"),
          payload: {
            snippet: "Thanks for reaching out.",
          },
        },
      },
      {
        env: {
          ...process.env,
          HUBSPOT_PRIVATE_APP_TOKEN: "hubspot-token",
        },
      },
    );

    expect(result).toEqual({
      mirrored: true,
      companyId: "company-1",
      contactId: "contact-1",
      noteId: "note-1",
      companyCreated: true,
      contactCreated: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(8);

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/crm/v3/objects/companies/search");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "domain",
              operator: "EQ",
              value: "demo-dental.invalid",
            },
          ],
        },
      ],
    });

    expect(fetchMock.mock.calls[1]?.[0]).toContain("/crm/v3/objects/companies");
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      properties: {
        name: "Atlas Dental Group",
        domain: "demo-dental.invalid",
        website: "https://demo-dental.invalid",
        phone: "+1 555 000 0000",
        industry: "Dental Clinics",
      },
    });

    expect(fetchMock.mock.calls[2]?.[0]).toContain("/crm/v3/objects/contacts/search");
    expect(fetchMock.mock.calls[3]?.[0]).toContain("/crm/v3/objects/contacts");
    expect(fetchMock.mock.calls[4]?.[0]).toContain(
      "/crm/v4/objects/contact/contact-1/associations/default/company/company-1",
    );
    expect(fetchMock.mock.calls[5]?.[0]).toContain("/crm/v3/objects/notes");
    expect(JSON.parse(fetchMock.mock.calls[5]?.[1]?.body as string)).toMatchObject({
      properties: {
        hs_note_body: expect.stringContaining("REPLY"),
      },
    });
    expect(fetchMock.mock.calls[6]?.[0]).toContain(
      "/crm/v4/objects/notes/note-1/associations/default/company/company-1",
    );
    expect(fetchMock.mock.calls[7]?.[0]).toContain(
      "/crm/v4/objects/notes/note-1/associations/default/contact/contact-1",
    );
  });
});

describe("upsertHubSpotDeal", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates a new deal and associates it with company and contact", async () => {
    const fetchMock = vi
      .fn()
      // search for deal — not found
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      // create deal
      .mockResolvedValueOnce(jsonResponse({ id: "deal-1" }))
      // associate deal to company
      .mockResolvedValueOnce(jsonResponse(null, 204))
      // associate deal to contact
      .mockResolvedValueOnce(jsonResponse(null, 204));

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await upsertHubSpotDeal(
      {
        companyName: "Atlas Dental Group",
        companyHubSpotId: "company-1",
        contactHubSpotId: "contact-1",
        dealProperties: {
          dealname: "Outreach: Atlas Dental Group",
          dealstage: "scored",
          pipeline: "default",
          description: "Stage: scored",
        },
      },
      {
        env: { ...process.env, HUBSPOT_PRIVATE_APP_TOKEN: "hubspot-token" },
      },
    );

    expect(result).toEqual({ dealId: "deal-1", created: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/crm/v3/objects/deals/search");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/crm/v3/objects/deals");
    expect(fetchMock.mock.calls[2]?.[0]).toContain(
      "/crm/v4/objects/deal/deal-1/associations/default/company/company-1",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toContain(
      "/crm/v4/objects/deal/deal-1/associations/default/contact/contact-1",
    );
  });

  it("updates an existing deal when one is found by name", async () => {
    const fetchMock = vi
      .fn()
      // search for deal — found
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: "deal-existing" }] }))
      // update deal
      .mockResolvedValueOnce(jsonResponse({ id: "deal-existing" }))
      // associate deal to company
      .mockResolvedValueOnce(jsonResponse(null, 204));

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await upsertHubSpotDeal(
      {
        companyName: "Atlas Dental Group",
        companyHubSpotId: "company-1",
        dealProperties: {
          dealname: "Outreach: Atlas Dental Group",
          dealstage: "sent",
          pipeline: "default",
          description: "Stage: sent",
        },
      },
      {
        env: { ...process.env, HUBSPOT_PRIVATE_APP_TOKEN: "hubspot-token" },
      },
    );

    expect(result).toEqual({ dealId: "deal-existing", created: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("progressHubSpotDealStage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns skipped when HubSpot is not configured", async () => {
    const result = await progressHubSpotDealStage(
      {
        company: { name: "Atlas Dental Group" },
        stage: "scored",
        context: { leadScore: 72 },
      },
      { env: { ...process.env, HUBSPOT_PRIVATE_APP_TOKEN: undefined } },
    );

    expect(result).toEqual({
      skipped: true,
      reason: "HUBSPOT_PRIVATE_APP_TOKEN is not configured.",
    });
  });

  it("upserts company, deal, and note when configured", async () => {
    const fetchMock = vi
      .fn()
      // company search — not found
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      // create company
      .mockResolvedValueOnce(jsonResponse({ id: "company-1" }))
      // deal search — not found
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      // create deal
      .mockResolvedValueOnce(jsonResponse({ id: "deal-1" }))
      // associate deal to company
      .mockResolvedValueOnce(jsonResponse(null, 204))
      // create note
      .mockResolvedValueOnce(jsonResponse({ id: "note-1" }))
      // associate note to deal
      .mockResolvedValueOnce(jsonResponse(null, 204));

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await progressHubSpotDealStage(
      {
        company: {
          name: "Atlas Dental Group",
          website: "https://demo-dental.invalid",
          normalizedDomain: "demo-dental.invalid",
        },
        stage: "scored",
        context: {
          leadScore: 72,
          painSummary: "Relies on walk-ins",
          confidence: 0.8,
        },
      },
      {
        env: { ...process.env, HUBSPOT_PRIVATE_APP_TOKEN: "hubspot-token" },
        fetchImpl: fetchMock as typeof fetch,
      },
    );

    expect(result).toMatchObject({ dealId: "deal-1", noteId: "note-1" });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
