export {};

const findConnection = vi.fn();
const updateConnection = vi.fn();
const updateManyConnections = vi.fn();
const findDrafts = vi.fn();
const createAuthorizedGoogleClient = vi.fn();
const registerGoogleWorkspaceGmailWatch = vi.fn();
const verifyGoogleWorkspacePushToken = vi.fn();
const fetchGoogleWorkspaceGmailHistory = vi.fn();
const fetchGoogleWorkspaceGmailThread = vi.fn();
const syncGmailReplyStateForDraft = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    googleWorkspaceConnection: {
      findUnique: findConnection,
      update: updateConnection,
      updateMany: updateManyConnections,
    },
    outreachDraft: {
      findMany: findDrafts,
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
  verifyGoogleWorkspacePushToken,
}));

vi.mock("@/lib/providers/google-workspace/gmail", () => ({
  registerGoogleWorkspaceGmailWatch,
  fetchGoogleWorkspaceGmailHistory,
  fetchGoogleWorkspaceGmailThread,
}));

vi.mock("@/lib/domain/gmail-engagement", () => ({
  syncGmailReplyStateForDraft,
}));

describe("google workspace gmail watch routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_GMAIL_PUBSUB_TOPIC: "projects/demo/topics/gmail-engagement",
      GOOGLE_GMAIL_PUSH_AUDIENCE: "https://example.com/api/google-workspace/gmail-watch/webhook",
      GOOGLE_GMAIL_PUSH_SERVICE_ACCOUNT_EMAIL: "pubsub-push@example.iam.gserviceaccount.com",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("registers a Gmail watch and persists the watch metadata", async () => {
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
      encryptedAccessToken: "enc-access",
      encryptedRefreshToken: "enc-refresh",
      accessTokenExpiresAt: new Date("2026-04-01T10:00:00.000Z"),
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "oauth-token" });
    registerGoogleWorkspaceGmailWatch.mockResolvedValueOnce({
      historyId: "history-123",
      expiration: "2026-04-01T11:00:00.000Z",
      topicName: "projects/demo/topics/gmail-engagement",
    });
    updateConnection.mockResolvedValueOnce({ id: "workspace-1" });

    const { POST } = await import("@/app/api/google-workspace/gmail-watch/register/route");
    const response = await POST(new Request("http://localhost/api/google-workspace/gmail-watch/register"));

    expect(createAuthorizedGoogleClient).toHaveBeenCalled();
    expect(registerGoogleWorkspaceGmailWatch).toHaveBeenCalledWith(
      expect.objectContaining({
        topicName: "projects/demo/topics/gmail-engagement",
      }),
    );
    expect(updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "google_workspace" },
        data: expect.objectContaining({
          gmailWatchTopic: "projects/demo/topics/gmail-engagement",
          gmailWatchHistoryId: "history-123",
          gmailWatchExpiresAt: new Date("2026-04-01T11:00:00.000Z"),
          gmailWatchStatus: "SYNCED",
          gmailWatchLastError: null,
        }),
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/leads?gmailWatch=connected",
    );
  });

  it("verifies a Pub/Sub push notification and syncs matching Gmail threads", async () => {
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
      email: "operator@example.com",
      encryptedAccessToken: "enc-access",
      encryptedRefreshToken: "enc-refresh",
      accessTokenExpiresAt: new Date("2026-04-01T10:00:00.000Z"),
      gmailWatchHistoryId: "history-100",
    });
    verifyGoogleWorkspacePushToken.mockResolvedValueOnce({
      email_verified: true,
      email: "pubsub-push@example.iam.gserviceaccount.com",
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "oauth-token" });
    fetchGoogleWorkspaceGmailHistory.mockResolvedValueOnce({
      historyId: "history-200",
      threadIds: ["thread-1"],
    });
    findDrafts.mockResolvedValueOnce([
      {
        id: "draft-1",
        companyId: "company-1",
        contactId: "contact-1",
        gmailDraftLink: {
          gmailDraftId: "gmail-draft-1",
          gmailThreadId: "thread-1",
          syncStatus: "SYNCED",
        },
        childDrafts: [{ id: "follow-up-1" }],
      },
    ]);
    fetchGoogleWorkspaceGmailThread.mockResolvedValueOnce({
      threadId: "thread-1",
      accountEmail: "operator@example.com",
      messageCount: 2,
      sentAt: "2024-03-29T10:00:00.000Z",
      latestMessageAt: "2024-03-29T11:00:00.000Z",
      latestMessageDirection: "INBOUND",
      hasReply: true,
      replyDetectedAt: "2024-03-29T11:00:00.000Z",
      replyMessageId: "message-2",
      messages: [],
    });
    syncGmailReplyStateForDraft.mockResolvedValueOnce({
      gmailDraftLink: { id: "gmail-link-1" },
      replyEventCreated: true,
    });
    updateConnection.mockResolvedValueOnce({ id: "workspace-1" });

    const payload = {
      emailAddress: "operator@example.com",
      historyId: "history-200",
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

    const { POST } = await import("@/app/api/google-workspace/gmail-watch/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/google-workspace/gmail-watch/webhook", {
        method: "POST",
        headers: {
          authorization: "Bearer push-token",
        },
        body: JSON.stringify({
          message: {
            data: encoded,
            messageId: "pubsub-message-1",
            publishTime: "2026-03-30T10:00:00.000Z",
          },
          subscription: "projects/demo/subscriptions/gmail-engagement",
        }),
      }),
    );
    const body = await response.json();

    expect(verifyGoogleWorkspacePushToken).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: "push-token",
        audience: "https://example.com/api/google-workspace/gmail-watch/webhook",
      }),
    );
    expect(fetchGoogleWorkspaceGmailHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        startHistoryId: "history-100",
      }),
    );
    expect(syncGmailReplyStateForDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "draft-1",
        }),
        thread: expect.objectContaining({
          threadId: "thread-1",
        }),
      }),
    );
    expect(updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "google_workspace" },
        data: expect.objectContaining({
          gmailWatchHistoryId: "history-200",
          gmailWatchStatus: "SYNCED",
          gmailWatchLastError: null,
        }),
      }),
    );
    expect(body).toEqual({
      ok: true,
      threadCount: 1,
      processedDrafts: 1,
      replyEventsCreated: 1,
    });
  });

  it("renews the Gmail watch through a protected internal route when expiry is near", async () => {
    process.env = {
      ...process.env,
      CRON_SECRET: "cron-secret",
    };
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
      encryptedAccessToken: "enc-access",
      encryptedRefreshToken: "enc-refresh",
      accessTokenExpiresAt: new Date("2026-04-01T10:00:00.000Z"),
      gmailWatchExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "oauth-token" });
    registerGoogleWorkspaceGmailWatch.mockResolvedValueOnce({
      historyId: "history-456",
      expiration: "2026-04-02T11:00:00.000Z",
      topicName: "projects/demo/topics/gmail-engagement",
    });
    updateConnection.mockResolvedValueOnce({ id: "workspace-1" });

    const { GET } = await import("@/app/api/internal/google-workspace/renew-watch/route");
    const response = await GET(
      new Request("http://localhost/api/internal/google-workspace/renew-watch", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(registerGoogleWorkspaceGmailWatch).toHaveBeenCalled();
    expect(updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "google_workspace" },
        data: expect.objectContaining({
          gmailWatchHistoryId: "history-456",
          gmailWatchStatus: "SYNCED",
          gmailWatchLastError: null,
        }),
      }),
    );
    expect(body).toMatchObject({
      ok: true,
      renewed: true,
      skipped: false,
    });
  });
});
