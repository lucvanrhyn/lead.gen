export {};

const findDraft = vi.fn();
const findConnection = vi.fn();
const gmailUpsert = vi.fn();
const findReplyEvent = vi.fn();
const createReplyEvent = vi.fn();
const updateManyDrafts = vi.fn();
const createAuthorizedGoogleClient = vi.fn();
const fetchGoogleWorkspaceGmailThread = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      findUnique: findDraft,
      updateMany: updateManyDrafts,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
    gmailDraftLink: {
      upsert: gmailUpsert,
    },
    outreachEngagementEvent: {
      findFirst: findReplyEvent,
      create: createReplyEvent,
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
}));

vi.mock("@/lib/providers/google-workspace/gmail", () => ({
  fetchGoogleWorkspaceGmailThread,
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
    findReplyEvent.mockResolvedValueOnce(null);
    gmailUpsert.mockResolvedValueOnce({
      id: "gmail-link-1",
      syncStatus: "SYNCED",
      lastSyncedAt: new Date("2026-03-30T10:00:00.000Z"),
    });
    createReplyEvent.mockResolvedValueOnce({
      id: "event-1",
      eventType: "REPLY",
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
    expect(gmailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          syncStatus: "SYNCED",
        }),
      }),
    );
    expect(findReplyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outreachDraftId: "draft-1",
          eventType: "REPLY",
        }),
      }),
    );
    expect(createReplyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outreachDraftId: "draft-1",
          eventType: "REPLY",
          payload: expect.objectContaining({
            hasReply: true,
          }),
        }),
      }),
    );
    expect(updateManyDrafts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: ["follow-up-1"],
          },
        },
        data: expect.objectContaining({
          approvalStatus: "REJECTED",
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
    findReplyEvent.mockResolvedValueOnce(null);
    gmailUpsert.mockResolvedValueOnce({
      id: "gmail-link-1",
      syncStatus: "SYNCED",
      lastSyncedAt: new Date("2026-03-30T10:00:00.000Z"),
    });

    const { POST } = await import(
      "@/app/api/outreach-drafts/[id]/refresh-gmail-thread/route"
    );
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(createReplyEvent).not.toHaveBeenCalled();
    expect(updateManyDrafts).not.toHaveBeenCalled();
    expect(payload.replyEventCreated).toBe(false);
    expect(payload.thread.hasReply).toBe(false);
  });
});
