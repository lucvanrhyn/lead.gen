import { ApprovalStatus, EngagementEventType, OutreachDraftType, type PrismaClient } from "@prisma/client";

export const FOLLOW_UP_SEQUENCE = [
  { step: 2, delayDays: 3, angle: "bump" as const },
  { step: 3, delayDays: 7, angle: "value_add" as const },
  { step: 4, delayDays: 12, angle: "soft_close" as const },
] as const;

export type FollowUpAngle = "bump" | "value_add" | "question" | "soft_close";

type FollowUpSchedulerDatabaseClient = Pick<
  PrismaClient,
  "outreachDraft" | "outreachEngagementEvent" | "company" | "replyAnalysis"
>;

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export async function createFollowUpSkeletons(
  initialDraft: {
    id: string;
    companyId: string;
    contactId: string | null;
    createdAt: Date;
  },
  db: FollowUpSchedulerDatabaseClient,
): Promise<string[]> {
  const createdIds: string[] = [];

  for (const entry of FOLLOW_UP_SEQUENCE) {
    const scheduledSendAt = addDays(initialDraft.createdAt, entry.delayDays);

    const created = await db.outreachDraft.create({
      data: {
        companyId: initialDraft.companyId,
        contactId: initialDraft.contactId,
        parentDraftId: initialDraft.id,
        draftType: OutreachDraftType.FOLLOW_UP,
        sequenceStep: entry.step,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        scheduledSendAt,
        sequenceStatus: "active",
        emailSubject1: "[pending]",
        emailSubject2: "[pending]",
        coldEmailShort: "[pending]",
        coldEmailMedium: "[pending]",
        linkedinMessageSafe: "[pending]",
        followUp1: "[pending]",
        followUp2: "[pending]",
      },
      select: { id: true },
    });

    createdIds.push(created.id);
  }

  return createdIds;
}

export async function checkFollowUpStopConditions(
  companyId: string,
  parentDraftId: string,
  db: FollowUpSchedulerDatabaseClient,
): Promise<{ shouldStop: boolean; reason: string | null }> {
  const replyEvent = await db.outreachEngagementEvent.findFirst({
    where: {
      outreachDraftId: parentDraftId,
      eventType: EngagementEventType.REPLY,
    },
    select: { id: true },
  });

  if (replyEvent) {
    return { shouldStop: true, reason: "reply_received" };
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { leadState: true },
  });

  if (company?.leadState === "do_not_contact" || company?.leadState === "closed_lost") {
    return { shouldStop: true, reason: `company_lead_state:${company.leadState}` };
  }

  const parentDraft = await db.outreachDraft.findUnique({
    where: { id: parentDraftId },
    select: { approvalStatus: true },
  });

  if (parentDraft?.approvalStatus === ApprovalStatus.REJECTED) {
    return { shouldStop: true, reason: "parent_draft_rejected" };
  }

  const stopAnalysis = await db.replyAnalysis.findFirst({
    where: {
      outreachDraftId: parentDraftId,
      shouldStopFollowUps: true,
    },
    select: { id: true },
  });

  if (stopAnalysis) {
    return { shouldStop: true, reason: "reply_analysis_stop_flag" };
  }

  return { shouldStop: false, reason: null };
}

export async function getFollowUpsDueForProcessing(
  db: FollowUpSchedulerDatabaseClient,
  limit = 10,
) {
  const now = new Date();

  return db.outreachDraft.findMany({
    where: {
      draftType: OutreachDraftType.FOLLOW_UP,
      sequenceStatus: "active",
      scheduledSendAt: { lte: now },
      emailSubject1: "[pending]",
    },
    include: {
      parentDraft: {
        include: {
          company: {
            include: {
              painHypotheses: { orderBy: { createdAt: "desc" }, take: 1 },
              leadMagnets: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
          contact: true,
        },
      },
    },
    take: limit,
    orderBy: { scheduledSendAt: "asc" },
  });
}
