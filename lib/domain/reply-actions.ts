export type ReplyActionResult = {
  leadStateUpdate: string | null;
  stopFollowUps: boolean;
  flagForReview: boolean;
  generateReplyDraft: boolean;
  adjustFollowUpTiming: boolean;
};

const CLASSIFICATION_ACTIONS: Record<string, ReplyActionResult> = {
  INTERESTED: {
    leadStateUpdate: "qualified",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: true,
    adjustFollowUpTiming: false,
  },
  BOOKED: {
    leadStateUpdate: "booked",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: false,
    adjustFollowUpTiming: false,
  },
  NOT_INTERESTED: {
    leadStateUpdate: "closed_lost",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: false,
    adjustFollowUpTiming: false,
  },
  UNSUBSCRIBE: {
    leadStateUpdate: "do_not_contact",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: false,
    adjustFollowUpTiming: false,
  },
  BOUNCED: {
    leadStateUpdate: null,
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: false,
    adjustFollowUpTiming: false,
  },
  REFERRAL: {
    leadStateUpdate: null,
    stopFollowUps: false,
    flagForReview: true,
    generateReplyDraft: true,
    adjustFollowUpTiming: false,
  },
  QUESTION_ASKED: {
    leadStateUpdate: "replied",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: true,
    adjustFollowUpTiming: false,
  },
  OUT_OF_OFFICE: {
    leadStateUpdate: null,
    stopFollowUps: false,
    flagForReview: false,
    generateReplyDraft: false,
    adjustFollowUpTiming: true,
  },
  MAYBE_LATER: {
    leadStateUpdate: "replied",
    stopFollowUps: true,
    flagForReview: false,
    generateReplyDraft: true,
    adjustFollowUpTiming: false,
  },
};

export function determineReplyActions(classification: string): ReplyActionResult {
  const actions = CLASSIFICATION_ACTIONS[classification];

  if (!actions) {
    return {
      leadStateUpdate: null,
      stopFollowUps: false,
      flagForReview: true,
      generateReplyDraft: false,
      adjustFollowUpTiming: false,
    };
  }

  return { ...actions };
}
