const gmailGetProfile = vi.fn();
const gmailThreadGet = vi.fn();
const gmailWatch = vi.fn();
const gmailHistoryList = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    gmail: vi.fn(() => ({
      users: {
        getProfile: gmailGetProfile,
        watch: gmailWatch,
        threads: {
          get: gmailThreadGet,
        },
        history: {
          list: gmailHistoryList,
        },
      },
    })),
  },
}));

import {
  appendOutreachDeliveryLinks,
  buildGmailDraftRawMessage,
  fetchGoogleWorkspaceGmailHistory,
  fetchGoogleWorkspaceGmailThread,
  registerGoogleWorkspaceGmailWatch,
} from "@/lib/providers/google-workspace/gmail";

describe("buildGmailDraftRawMessage", () => {
  it("builds a base64url encoded MIME message for a draft", () => {
    const raw = buildGmailDraftRawMessage({
      to: "jane@demo-dental.invalid",
      subject: "A quick idea for Atlas Dental bookings",
      body: "Hello Megan",
    });

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );

    expect(decoded).toContain("To: jane@demo-dental.invalid");
    expect(decoded).toContain("Subject: A quick idea for Atlas Dental bookings");
    expect(decoded).toContain("Hello Megan");
  });
});

describe("appendOutreachDeliveryLinks", () => {
  it("adds hosted asset and diagnostic links to the draft body", () => {
    const body = appendOutreachDeliveryLinks({
      body: "Hello Megan",
      assetUrl: "https://example.com/assets/atlas-demo",
      diagnosticFormUrl: "https://forms.gle/example",
    });

    expect(body).toContain("https://example.com/assets/atlas-demo");
    expect(body).toContain("https://forms.gle/example");
  });
});

describe("fetchGoogleWorkspaceGmailThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes Gmail thread state and detects a recipient reply", async () => {
    gmailGetProfile.mockResolvedValueOnce({
      data: {
        emailAddress: "operator@studio.example",
      },
    });
    gmailThreadGet.mockResolvedValueOnce({
      data: {
        id: "thread-1",
        historyId: "history-1",
        messages: [
          {
            id: "message-1",
            threadId: "thread-1",
            internalDate: "1711713600000",
            labelIds: ["SENT"],
            snippet: "Hello Megan",
            payload: {
              headers: [
                { name: "From", value: "Operator <operator@studio.example>" },
                { name: "To", value: "Jane Demo <jane@demo-dental.invalid>" },
                { name: "Subject", value: "A quick idea for Atlas Dental bookings" },
                { name: "Message-ID", value: "<message-1@studio.example>" },
              ],
            },
          },
          {
            id: "message-2",
            threadId: "thread-1",
            internalDate: "1711717200000",
            labelIds: ["INBOX"],
            snippet: "Sounds interesting",
            payload: {
              headers: [
                { name: "From", value: "Jane Demo <jane@demo-dental.invalid>" },
                { name: "To", value: "Operator <operator@studio.example>" },
                { name: "Subject", value: "Re: A quick idea for Atlas Dental bookings" },
                { name: "In-Reply-To", value: "<message-1@studio.example>" },
                { name: "References", value: "<message-1@studio.example>" },
                { name: "Message-ID", value: "<message-2@demo-dental.invalid>" },
              ],
            },
          },
        ],
      },
    });

    const thread = await fetchGoogleWorkspaceGmailThread({
      auth: { token: "oauth-token" },
      threadId: "thread-1",
    });

    expect(gmailThreadGet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        id: "thread-1",
        format: "full",
      }),
    );
    expect(thread).toMatchObject({
      threadId: "thread-1",
      accountEmail: "operator@studio.example",
      messageCount: 2,
      hasReply: true,
      latestMessageDirection: "INBOUND",
      replyMessageId: "message-2",
      replyDetectedAt: "2024-03-29T13:00:00.000Z",
    });
    expect(thread.messages[0]).toMatchObject({
      id: "message-1",
      direction: "OUTBOUND",
      isReply: false,
      fromEmail: "operator@studio.example",
    });
    expect(thread.messages[1]).toMatchObject({
      id: "message-2",
      direction: "INBOUND",
      isReply: true,
      fromEmail: "jane@demo-dental.invalid",
    });
  });
});

describe("registerGoogleWorkspaceGmailWatch", () => {
  it("registers an inbox watch and normalizes the expiration date", async () => {
    gmailWatch.mockResolvedValueOnce({
      data: {
        historyId: "history-99",
        expiration: "1777777777000",
      },
    });

    const watch = await registerGoogleWorkspaceGmailWatch({
      auth: { token: "oauth-token" },
      topicName: "projects/demo/topics/lead-engine-gmail",
      labelIds: ["INBOX"],
    });

    expect(gmailWatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        requestBody: expect.objectContaining({
          topicName: "projects/demo/topics/lead-engine-gmail",
          labelIds: ["INBOX"],
          labelFilterBehavior: "INCLUDE",
        }),
      }),
    );
    expect(watch.historyId).toBe("history-99");
    expect(watch.expiration).toBe("2026-05-03T03:09:37.000Z");
  });
});

describe("fetchGoogleWorkspaceGmailHistory", () => {
  it("collects unique inbox thread ids from Gmail history", async () => {
    gmailHistoryList.mockResolvedValueOnce({
      data: {
        historyId: "history-200",
        history: [
          {
            messagesAdded: [
              {
                message: {
                  threadId: "thread-1",
                  labelIds: ["INBOX"],
                },
              },
              {
                message: {
                  threadId: "thread-1",
                  labelIds: ["INBOX"],
                },
              },
              {
                message: {
                  threadId: "thread-2",
                  labelIds: ["SENT"],
                },
              },
            ],
          },
        ],
      },
    });

    const history = await fetchGoogleWorkspaceGmailHistory({
      auth: { token: "oauth-token" },
      startHistoryId: "history-100",
    });

    expect(gmailHistoryList).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        startHistoryId: "history-100",
        historyTypes: ["messageAdded"],
      }),
    );
    expect(history).toEqual({
      historyId: "history-200",
      threadIds: ["thread-1"],
    });
  });
});
