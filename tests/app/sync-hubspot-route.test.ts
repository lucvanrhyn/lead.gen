export {};

const findDraft = vi.fn();
const isHubSpotConfigured = vi.fn();
const syncOutreachDraftToHubSpot = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
    },
  },
}));

vi.mock("@/lib/providers/hubspot/client", () => ({
  isHubSpotConfigured,
  syncOutreachDraftToHubSpot,
}));

describe("sync hubspot route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips cleanly when HubSpot is not configured", async () => {
    isHubSpotConfigured.mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/outreach-drafts/[id]/sync-hubspot/route");
    const response = await POST(new Request("http://localhost:3000"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      mirrored: false,
      skipped: true,
      reason: "HUBSPOT_PRIVATE_APP_TOKEN is not configured.",
    });
    expect(findDraft).not.toHaveBeenCalled();
    expect(syncOutreachDraftToHubSpot).not.toHaveBeenCalled();
  });

  it("passes the draft payload to the HubSpot mirror client when configured", async () => {
    isHubSpotConfigured.mockReturnValueOnce(true);
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      approvalStatus: "APPROVED",
      emailSubject1: "A quick idea for Atlas Dental bookings",
      sequenceStep: 1,
      draftType: "INITIAL",
      company: {
        id: "company-1",
        name: "Atlas Dental Group",
        website: "https://atlasdental.co.za",
        normalizedDomain: "atlasdental.co.za",
        phone: "+27 21 555 0133",
        industry: "Dental Clinics",
      },
      contact: {
        id: "contact-1",
        fullName: "Megan Jacobs",
        firstName: "Megan",
        lastName: "Jacobs",
        email: "megan@atlasdental.co.za",
        title: "Practice Manager",
        phone: "+27 82 555 0199",
      },
      engagementEvents: [
        {
          id: "event-1",
          eventType: "CLICK",
          occurredAt: new Date("2026-03-30T10:15:00.000Z"),
          payload: { url: "https://example.com/assets/atlas-demo" },
        },
      ],
      gmailDraftLink: {
        syncStatus: "SYNCED",
      },
    });
    syncOutreachDraftToHubSpot.mockResolvedValueOnce({
      mirrored: true,
      companyId: "company-1",
      contactId: "contact-1",
      noteId: "note-1",
      companyCreated: true,
      contactCreated: true,
    });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/sync-hubspot/route");
    const response = await POST(new Request("http://localhost:3000"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-1" },
      }),
    );
    expect(syncOutreachDraftToHubSpot).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "draft-1",
          emailSubject1: "A quick idea for Atlas Dental bookings",
        }),
        company: expect.objectContaining({
          id: "company-1",
          name: "Atlas Dental Group",
        }),
        contact: expect.objectContaining({
          email: "megan@atlasdental.co.za",
        }),
        event: expect.objectContaining({
          id: "event-1",
          eventType: "CLICK",
        }),
      }),
      expect.any(Object),
    );
    expect(payload).toEqual({
      mirrored: true,
      companyId: "company-1",
      contactId: "contact-1",
      noteId: "note-1",
      companyCreated: true,
      contactCreated: true,
    });
  });

  it("blocks HubSpot sync before the draft is handed off to Gmail", async () => {
    isHubSpotConfigured.mockReturnValueOnce(true);
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      approvalStatus: "APPROVED",
      gmailDraftLink: {
        syncStatus: "NOT_READY",
      },
      company: {
        id: "company-1",
        name: "Atlas Dental Group",
      },
      engagementEvents: [],
    });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/sync-hubspot/route");
    const response = await POST(new Request("http://localhost:3000"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/handed off to Gmail/i);
    expect(syncOutreachDraftToHubSpot).not.toHaveBeenCalled();
  });
});
