export {};

const findDraft = vi.fn();
const findConnection = vi.fn();
const draftUpdate = vi.fn();
const gmailUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
      update: draftUpdate,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
    gmailDraftLink: {
      upsert: gmailUpsert,
    },
  },
}));

describe("approve outreach draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a pending draft approved and ready for Gmail sync", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      contact: {
        email: "megan@atlasdental.co.za",
      },
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
    });
    draftUpdate.mockResolvedValueOnce({ id: "draft-1", approvalStatus: "APPROVED" });
    gmailUpsert.mockResolvedValueOnce({ id: "gmail-1", syncStatus: "READY" });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/approve/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(draftUpdate).toHaveBeenCalled();
    expect(gmailUpsert).toHaveBeenCalled();
    expect(payload.approvalStatus).toBe("APPROVED");
  });

  it("approves the draft but keeps Gmail sync blocked when there is no contact email", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      contact: {
        email: null,
      },
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
    });
    draftUpdate.mockResolvedValueOnce({ id: "draft-1", approvalStatus: "APPROVED" });
    gmailUpsert.mockResolvedValueOnce({ id: "gmail-1", syncStatus: "NOT_READY" });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/approve/route");
    await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });

    expect(gmailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          syncStatus: "NOT_READY",
        }),
      }),
    );
  });
});
