const findDraft = vi.fn();
const findConnection = vi.fn();
const createAuthorizedGoogleClient = vi.fn();
const createGoogleWorkspaceGmailDraft = vi.fn();
const gmailUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
    gmailDraftLink: {
      upsert: gmailUpsert,
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
}));

vi.mock("@/lib/providers/google-workspace/gmail", () => ({
  appendOutreachDeliveryLinks: vi.fn(({ body, assetUrl, diagnosticFormUrl }) =>
    [body, assetUrl ? `Lead magnet: ${assetUrl}` : null, diagnosticFormUrl ? `Diagnostic form: ${diagnosticFormUrl}` : null]
      .filter(Boolean)
      .join("\n\n"),
  ),
  createGoogleWorkspaceGmailDraft,
}));

describe("create gmail draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes hosted asset and form links in the Gmail draft body", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      approvalStatus: "APPROVED",
      emailSubject1: "A quick idea for Atlas Dental bookings",
      coldEmailMedium: "Hello Megan",
      contact: {
        email: "megan@atlasdental.co.za",
      },
      gmailDraftLink: null,
      leadMagnetAsset: {
        slug: "atlas-demo",
        diagnosticFormUrl: "https://forms.gle/example",
      },
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "ok" });
    createGoogleWorkspaceGmailDraft.mockResolvedValueOnce({
      gmailDraftId: "gmail-draft-1",
      gmailThreadId: "gmail-thread-1",
    });
    gmailUpsert.mockResolvedValueOnce({
      outreachDraftId: "draft-1",
      gmailDraftId: "gmail-draft-1",
      syncStatus: "SYNCED",
    });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/create-gmail-draft/route");
    const response = await POST(new Request("http://localhost:3000"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });

    expect(response.status).toBe(200);
    expect(createGoogleWorkspaceGmailDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("http://localhost:3000/assets/atlas-demo"),
      }),
    );
    expect(createGoogleWorkspaceGmailDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("https://forms.gle/example"),
      }),
    );
  });
});

export {};
