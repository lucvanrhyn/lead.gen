import { ApprovalStatus, EngagementEventType, ExternalSyncStatus } from "@prisma/client";

export type OutreachSuppressionReason =
  | "duplicate_contact"
  | "company_cooldown"
  | "active_engagement";

export type OutreachSuppressionInput = {
  companyId: string;
  contactId?: string | null;
  contactEmail?: string | null;
  recentDrafts: Array<{
    id: string;
    companyId: string;
    contactId?: string | null;
    createdAt: Date;
    approvalStatus: ApprovalStatus;
    gmailSyncStatus: ExternalSyncStatus;
  }>;
  engagementEvents: Array<{
    id: string;
    outreachDraftId: string;
    eventType: EngagementEventType;
    occurredAt?: Date;
  }>;
  now?: Date;
  companyCooldownDays?: number;
  activeEngagementDays?: number;
};

export type OutreachSuppressionResult = {
  suppressed: boolean;
  reason?: OutreachSuppressionReason;
  note?: string;
  cooldownUntil?: Date;
};

export type CampaignAnalyticsInput = {
  drafts: Array<{
    id: string;
    companyId: string;
    approvalStatus: ApprovalStatus;
    gmailSyncStatus: ExternalSyncStatus;
    suppressionReason?: OutreachSuppressionReason | null;
  }>;
  engagementEvents: Array<{
    id: string;
    outreachDraftId: string;
    eventType: EngagementEventType;
  }>;
};

export type CampaignAnalytics = {
  sentCount: number;
  viewedCount: number;
  repliedCount: number;
  followUpDueCount: number;
  suppressedCount: number;
};

const DEFAULT_COMPANY_COOLDOWN_DAYS = 14;
const DEFAULT_ACTIVE_ENGAGEMENT_DAYS = 7;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isRecentDraftEligible(
  draft: {
    companyId: string;
    contactId?: string | null;
    createdAt: Date;
    approvalStatus: ApprovalStatus;
    gmailSyncStatus: ExternalSyncStatus;
  },
  now: Date,
  cooldownDays: number,
) {
  if (draft.approvalStatus === ApprovalStatus.REJECTED) {
    return false;
  }

  return now.getTime() - draft.createdAt.getTime() <= cooldownDays * 24 * 60 * 60 * 1000;
}

export function deriveOutreachSuppressionReason(
  input: OutreachSuppressionInput,
): OutreachSuppressionResult {
  const now = input.now ?? new Date();
  const companyCooldownDays = input.companyCooldownDays ?? DEFAULT_COMPANY_COOLDOWN_DAYS;
  const activeEngagementDays = input.activeEngagementDays ?? DEFAULT_ACTIVE_ENGAGEMENT_DAYS;
  const engagementWindowStart = addDays(now, -activeEngagementDays);

  const duplicateDraft = input.recentDrafts.find(
    (draft) =>
      draft.companyId === input.companyId &&
      Boolean(input.contactId) &&
      draft.contactId === input.contactId &&
      isRecentDraftEligible(draft, now, companyCooldownDays),
  );

  if (duplicateDraft) {
    return {
      suppressed: true,
      reason: "duplicate_contact",
      note: "This contact already has outreach in flight.",
      cooldownUntil: addDays(duplicateDraft.createdAt, companyCooldownDays),
    };
  }

  const companyCooldownDraft = input.recentDrafts.find(
    (draft) =>
      draft.companyId === input.companyId &&
      draft.gmailSyncStatus === ExternalSyncStatus.SYNCED &&
      isRecentDraftEligible(draft, now, companyCooldownDays),
  );

  if (companyCooldownDraft) {
    return {
      suppressed: true,
      reason: "company_cooldown",
      note: "This company was contacted recently.",
      cooldownUntil: addDays(companyCooldownDraft.createdAt, companyCooldownDays),
    };
  }

  const recentEvent = input.engagementEvents.find((event) => {
    if (!event.occurredAt) {
      return false;
    }

    return (
      event.occurredAt >= engagementWindowStart &&
      (event.eventType === EngagementEventType.REPLY ||
        event.eventType === EngagementEventType.OPEN ||
        event.eventType === EngagementEventType.CLICK ||
        event.eventType === EngagementEventType.ASSET_VIEW)
    );
  });

  if (recentEvent) {
    return {
      suppressed: true,
      reason: "active_engagement",
      note: "This lead is already actively engaged.",
    };
  }

  return {
    suppressed: false,
  };
}

export function summarizeCampaignAnalytics(input: CampaignAnalyticsInput): CampaignAnalytics {
  const sentDraftIds = new Set(
    input.drafts
      .filter((draft) => draft.gmailSyncStatus === ExternalSyncStatus.SYNCED)
      .map((draft) => draft.id),
  );
  const viewedDraftIds = new Set(
    input.engagementEvents
      .filter(
        (event) =>
          event.eventType === EngagementEventType.OPEN ||
          event.eventType === EngagementEventType.ASSET_VIEW,
      )
      .map((event) => event.outreachDraftId),
  );
  const repliedDraftIds = new Set(
    input.engagementEvents
      .filter((event) => event.eventType === EngagementEventType.REPLY)
      .map((event) => event.outreachDraftId),
  );

  return {
    sentCount: sentDraftIds.size,
    viewedCount: viewedDraftIds.size,
    repliedCount: repliedDraftIds.size,
    followUpDueCount: Array.from(sentDraftIds).filter(
      (draftId) => viewedDraftIds.has(draftId) && !repliedDraftIds.has(draftId),
    ).length,
    suppressedCount: input.drafts.filter((draft) => Boolean(draft.suppressionReason)).length,
  };
}
