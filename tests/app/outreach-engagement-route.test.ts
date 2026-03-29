export {};

const findDraft = vi.fn();
const createEvent = vi.fn();
const createFollowUp = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
      create: createFollowUp,
    },
    outreachEngagementEvent: {
      create: createEvent,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/ai/outreach", () => ({
  buildFollowUpDraft: vi.fn(() => ({
    email_subject_1: "Atlas Dental Group follow-up",
    email_subject_2: "Checking in on the teardown",
    cold_email_short: "Quick follow-up",
    cold_email_medium: "Saw you checked out the teardown.",
    linkedin_message_safe: "Quick follow-up on the teardown.",
    follow_up_1: "Following up on the teardown.",
    follow_up_2: "Happy to resend it.",
    follow_up_reason: "high_intent_click",
  })),
}));

describe("outreach engagement route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs a click event and creates a follow-up draft when one does not exist", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      companyId: "company-1",
      contactId: "contact-1",
      approvalStatus: "APPROVED",
      gmailDraftLink: { syncStatus: "SYNCED" },
      emailSubject1: "Atlas Dental Booking Funnel Teardown",
      company: { name: "Atlas Dental Group" },
      contact: { firstName: "Megan", fullName: "Megan Jacobs" },
      childDrafts: [],
    });
    createEvent.mockResolvedValueOnce({ id: "event-1", type: "CLICK" });
    createFollowUp.mockResolvedValueOnce({ id: "draft-2", draftType: "FOLLOW_UP" });
    transaction.mockImplementationOnce(async (callback) =>
      callback({
        outreachEngagementEvent: { create: createEvent },
        outreachDraft: { create: createFollowUp },
      }),
    );

    const { POST } = await import("@/app/api/outreach-drafts/[id]/engagement/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ eventType: "CLICK" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "draft-1" }) } as { params: Promise<{ id: string }> },
    );
    const payload = await response.json();

    expect(createEvent).toHaveBeenCalled();
    expect(createFollowUp).toHaveBeenCalled();
    expect(payload.followUpCreated).toBe(true);
  });

  it("does not create a duplicate follow-up when one already exists", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      companyId: "company-1",
      contactId: "contact-1",
      approvalStatus: "APPROVED",
      gmailDraftLink: { syncStatus: "SYNCED" },
      emailSubject1: "Atlas Dental Booking Funnel Teardown",
      company: { name: "Atlas Dental Group" },
      contact: { firstName: "Megan", fullName: "Megan Jacobs" },
      childDrafts: [{ id: "draft-2", draftType: "FOLLOW_UP" }],
    });
    createEvent.mockResolvedValueOnce({ id: "event-1", type: "ASSET_VIEW" });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/engagement/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ eventType: "ASSET_VIEW" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "draft-1" }) } as { params: Promise<{ id: string }> },
    );
    const payload = await response.json();

    expect(createEvent).toHaveBeenCalled();
    expect(createFollowUp).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(payload.followUpCreated).toBe(false);
  });

  it("rejects manual engagement logging before the draft has been synced to Gmail", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      companyId: "company-1",
      contactId: "contact-1",
      approvalStatus: "APPROVED",
      gmailDraftLink: { syncStatus: "READY" },
      emailSubject1: "Atlas Dental Booking Funnel Teardown",
      company: { name: "Atlas Dental Group" },
      contact: { firstName: "Megan", fullName: "Megan Jacobs" },
      childDrafts: [],
    });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/engagement/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ eventType: "CLICK" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "draft-1" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(409);
    expect(createEvent).not.toHaveBeenCalled();
    expect(createFollowUp).not.toHaveBeenCalled();
  });
});
