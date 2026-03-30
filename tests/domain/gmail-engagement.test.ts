export {};

const gmailDraftLinkUpsert = vi.fn();
const outreachEngagementFindFirst = vi.fn();
const outreachEngagementCreate = vi.fn();
const outreachDraftUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/providers/google-workspace/gmail", () => ({
  // The helper test only needs the thread snapshot type at runtime.
}));

import {
  type GmailEngagementDatabaseClient,
  syncGmailReplyStateForDraft,
} from "@/lib/domain/gmail-engagement";

describe("syncGmailReplyStateForDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the thread sync state and creates a reply engagement when a reply is detected", async () => {
    gmailDraftLinkUpsert.mockResolvedValueOnce({
      id: "gmail-link-1",
      syncStatus: "SYNCED",
    });
    outreachEngagementFindFirst.mockResolvedValueOnce(null);
    outreachEngagementCreate.mockResolvedValueOnce({
      id: "event-1",
      eventType: "REPLY",
    });
    outreachDraftUpdateMany.mockResolvedValueOnce({ count: 1 });
    transaction.mockImplementationOnce(async (callback) =>
      callback({
        outreachEngagementEvent: {
          create: outreachEngagementCreate,
        },
        outreachDraft: {
          updateMany: outreachDraftUpdateMany,
        },
      }),
    );

    const db = {
      gmailDraftLink: {
        upsert: gmailDraftLinkUpsert,
      },
      outreachEngagementEvent: {
        findFirst: outreachEngagementFindFirst,
      },
      outreachDraft: {
        updateMany: outreachDraftUpdateMany,
      },
      $transaction: transaction,
    } as unknown as GmailEngagementDatabaseClient;

    const result = await syncGmailReplyStateForDraft({
      db,
      draft: {
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
      thread: {
        threadId: "thread-1",
        accountEmail: "operator@studio.example",
        messageCount: 2,
        sentAt: "2024-03-29T10:00:00.000Z",
        latestMessageAt: "2024-03-29T11:00:00.000Z",
        latestMessageDirection: "INBOUND",
        hasReply: true,
        replyDetectedAt: "2024-03-29T11:00:00.000Z",
        replyMessageId: "message-2",
        messages: [],
      },
    });

    expect(gmailDraftLinkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { outreachDraftId: "draft-1" },
        update: expect.objectContaining({
          syncStatus: "SYNCED",
          gmailThreadId: "thread-1",
        }),
      }),
    );
    expect(outreachEngagementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outreachDraftId: "draft-1",
          eventType: "REPLY",
        }),
      }),
    );
    expect(outreachEngagementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outreachDraftId: "draft-1",
          eventType: "REPLY",
          payload: expect.objectContaining({
            hasReply: true,
            replyMessageId: "message-2",
          }),
        }),
      }),
    );
    expect(outreachDraftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: ["follow-up-1"],
          },
        },
      }),
    );
    expect(result).toEqual({
      gmailDraftLink: {
        id: "gmail-link-1",
        syncStatus: "SYNCED",
      },
      replyEventCreated: true,
    });
  });
});
