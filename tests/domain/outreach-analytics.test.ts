import { ApprovalStatus, EngagementEventType, ExternalSyncStatus } from "@prisma/client";

import {
  deriveOutreachSuppressionReason,
  summarizeCampaignAnalytics,
} from "@/lib/domain/outreach-analytics";

describe("deriveOutreachSuppressionReason", () => {
  it("suppresses a draft when the same contact already has outreach in flight", () => {
    const result = deriveOutreachSuppressionReason({
      companyId: "company-1",
      contactId: "contact-1",
      contactEmail: "jane@demo-dental.invalid",
      recentDrafts: [
        {
          id: "draft-1",
          companyId: "company-1",
          contactId: "contact-1",
          createdAt: new Date("2026-03-29T10:00:00Z"),
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          gmailSyncStatus: ExternalSyncStatus.NOT_READY,
        },
      ],
      engagementEvents: [],
      now: new Date("2026-03-30T10:00:00Z"),
    });

    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("duplicate_contact");
  });

  it("suppresses a company while the cooldown window is active", () => {
    const result = deriveOutreachSuppressionReason({
      companyId: "company-1",
      contactId: "contact-2",
      contactEmail: "ops@demo-dental.invalid",
      recentDrafts: [
        {
          id: "draft-1",
          companyId: "company-1",
          contactId: "contact-1",
          createdAt: new Date("2026-03-28T10:00:00Z"),
          approvalStatus: ApprovalStatus.APPROVED,
          gmailSyncStatus: ExternalSyncStatus.SYNCED,
        },
      ],
      engagementEvents: [],
      now: new Date("2026-03-30T10:00:00Z"),
    });

    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe("company_cooldown");
  });

  it("does not treat stale engagement as active suppression", () => {
    const result = deriveOutreachSuppressionReason({
      companyId: "company-1",
      contactId: "contact-2",
      contactEmail: "ops@demo-dental.invalid",
      recentDrafts: [],
      engagementEvents: [
        {
          id: "event-1",
          outreachDraftId: "draft-1",
          eventType: EngagementEventType.CLICK,
          occurredAt: new Date("2026-03-01T10:00:00Z"),
        },
      ],
      now: new Date("2026-03-30T10:00:00Z"),
    });

    expect(result.suppressed).toBe(false);
  });
});

describe("summarizeCampaignAnalytics", () => {
  it("rolls up sent, viewed, replied, follow-up due, and suppressed counts", () => {
    const analytics = summarizeCampaignAnalytics({
      drafts: [
        {
          id: "draft-1",
          companyId: "company-1",
          approvalStatus: ApprovalStatus.APPROVED,
          gmailSyncStatus: ExternalSyncStatus.SYNCED,
          suppressionReason: null,
        },
        {
          id: "draft-2",
          companyId: "company-1",
          approvalStatus: ApprovalStatus.APPROVED,
          gmailSyncStatus: ExternalSyncStatus.SYNCED,
          suppressionReason: null,
        },
        {
          id: "draft-3",
          companyId: "company-1",
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          gmailSyncStatus: ExternalSyncStatus.NOT_READY,
          suppressionReason: "duplicate_contact",
        },
      ],
      engagementEvents: [
        {
          id: "event-1",
          outreachDraftId: "draft-1",
          eventType: EngagementEventType.OPEN,
        },
        {
          id: "event-2",
          outreachDraftId: "draft-1",
          eventType: EngagementEventType.CLICK,
        },
        {
          id: "event-3",
          outreachDraftId: "draft-2",
          eventType: EngagementEventType.REPLY,
        },
      ],
    });

    expect(analytics).toMatchObject({
      sentCount: 2,
      viewedCount: 1,
      repliedCount: 1,
      followUpDueCount: 1,
      suppressedCount: 1,
    });
  });
});
