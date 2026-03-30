export {};

const findDraft = vi.fn();
const findConnection = vi.fn();
const createAuthorizedGoogleClient = vi.fn();
const fetchGoogleWorkspaceGmailThread = vi.fn();
const syncGmailReplyStateForDraft = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
}));

vi.mock("@/lib/providers/google-workspace/gmail", () => ({
  fetchGoogleWorkspaceGmailThread,
}));

vi.mock("@/lib/domain/gmail-engagement", () => ({
  syncGmailReplyStateForDraft,
}));

describe("refresh gmail thread route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a reply engagement when the Gmail thread contains an inbound response", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      companyId: "company-1",
      contactId: "contact-1",
      gmailDraftLink: {
        gmailDraftId: "gmail-draft-1",
        gmailThreadId: "thread-1",
        syncStatus: "SYNCED",
      },
      childDrafts: [
        {
          id: "follow-up-1",
        },
      ],
    });
    findConnection.mockResolvedValueOnce({
      status: "CONNECTED",
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({
      token: "oauth-token",
    });
    fetchGoogleWorkspaceGmailThread.mockResolvedValueOnce({
      threadId: "thread-1",
      accountEmail: "operator@studio.example",
      messageCount: 2,
      sentAt: "2024-03-29T10:00:00.000Z",
      latestMessageAt: "2024-03-29T11:00:00.000Z",
      latestMessageDirection: "INBOUND",
      hasReply: true,
      replyDetectedAt: "2024-03-29T11:00:00.000Z",
      replyMessageId: "message-2",
      messages: [
        {
          id: "message-1",
          direction: "OUTBOUND",
        },
        {
          id: "message-2",
          direction: "INBOUND",
        },
      ],
    });
    syncGmailReplyStateForDraft.mockResolvedValueOnce({
      id: "gmail-link-1",
      replyEventCreated: true,
      gmailDraftLink: {
        syncStatus: "SYNCED",
      },
    });

    const { POST } = await import(
      "@/app/api/outreach-drafts/[id]/refresh-gmail-thread/route"
    );
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(createAuthorizedGoogleClient).toHaveBeenCalled();
    expect(fetchGoogleWorkspaceGmailThread).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
      }),
    );
    expect(syncGmailReplyStateForDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "draft-1",
        }),
        thread: expect.objectContaining({
          hasReply: true,
        }),
      }),
    );
    expect(payload.replyEventCreated).toBe(true);
    expect(payload.thread.hasReply).toBe(true);
  });

  it("refreshes the Gmail thread without creating an engagement event when there is no reply", async () => {
    findDraft.mockResolvedValueOnce({
      id: "draft-1",
      companyId: "company-1",
      contactId: "contact-1",
      gmailDraftLink: {
        gmailDraftId: "gmail-draft-1",
        gmailThreadId: "thread-1",
        syncStatus: "SYNCED",
      },
      childDrafts: [],
    });
    findConnection.mockResolvedValueOnce({
      status: "CONNECTED",
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({
      token: "oauth-token",
    });
    fetchGoogleWorkspaceGmailThread.mockResolvedValueOnce({
      threadId: "thread-1",
      accountEmail: "operator@studio.example",
      messageCount: 1,
      sentAt: "2024-03-29T10:00:00.000Z",
      latestMessageAt: "2024-03-29T10:00:00.000Z",
      latestMessageDirection: "OUTBOUND",
      hasReply: false,
      replyDetectedAt: null,
      replyMessageId: null,
      messages: [
        {
          id: "message-1",
          direction: "OUTBOUND",
        },
      ],
    });
    syncGmailReplyStateForDraft.mockResolvedValueOnce({
      id: "gmail-link-1",
      replyEventCreated: false,
      gmailDraftLink: {
        syncStatus: "SYNCED",
      },
    });

    const { POST } = await import(
      "@/app/api/outreach-drafts/[id]/refresh-gmail-thread/route"
    );
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(syncGmailReplyStateForDraft).toHaveBeenCalled();
    expect(payload.replyEventCreated).toBe(false);
    expect(payload.thread.hasReply).toBe(false);
  });
});
