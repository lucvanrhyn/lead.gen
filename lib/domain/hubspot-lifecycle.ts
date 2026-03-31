export const HUBSPOT_DEAL_STAGES = {
  new: "new",
  enriched: "enriched",
  scored: "scored",
  drafted: "drafted",
  sent: "sent",
  follow_up_queued: "follow_up_queued",
  replied: "replied",
  qualified: "qualified",
  booked: "booked",
  closed_lost: "closedlost",
  do_not_contact: "do_not_contact",
} as const;

export type HubSpotDealStage = (typeof HUBSPOT_DEAL_STAGES)[keyof typeof HUBSPOT_DEAL_STAGES];

const LEAD_STATE_TO_DEAL_STAGE: Record<string, HubSpotDealStage> = {
  new: HUBSPOT_DEAL_STAGES.new,
  enriched: HUBSPOT_DEAL_STAGES.enriched,
  scored: HUBSPOT_DEAL_STAGES.scored,
  drafted: HUBSPOT_DEAL_STAGES.drafted,
  sent: HUBSPOT_DEAL_STAGES.sent,
  follow_up_queued: HUBSPOT_DEAL_STAGES.follow_up_queued,
  replied: HUBSPOT_DEAL_STAGES.replied,
  qualified: HUBSPOT_DEAL_STAGES.qualified,
  booked: HUBSPOT_DEAL_STAGES.booked,
  closed_lost: HUBSPOT_DEAL_STAGES.closed_lost,
  do_not_contact: HUBSPOT_DEAL_STAGES.do_not_contact,
};

export function mapLeadStateToDealStage(
  leadState: string | null,
  fallback: HubSpotDealStage = HUBSPOT_DEAL_STAGES.new,
): HubSpotDealStage {
  if (!leadState) {
    return fallback;
  }

  return LEAD_STATE_TO_DEAL_STAGE[leadState] ?? fallback;
}

export function buildDealProperties(input: {
  companyName: string;
  leadScore?: number | null;
  painSummary?: string | null;
  confidence?: number | null;
  recommendedChannel?: string | null;
  leadMagnetUsed?: string | null;
  stage: HubSpotDealStage;
}): Record<string, string> {
  const descriptionParts: string[] = [`Stage: ${input.stage}`];

  if (input.leadScore != null) {
    descriptionParts.push(`Lead Score: ${input.leadScore}`);
  }

  if (input.confidence != null) {
    descriptionParts.push(`Confidence: ${Math.round(input.confidence * 100)}%`);
  }

  if (input.recommendedChannel) {
    descriptionParts.push(`Channel: ${input.recommendedChannel}`);
  }

  if (input.leadMagnetUsed) {
    descriptionParts.push(`Lead Magnet: ${input.leadMagnetUsed}`);
  }

  if (input.painSummary) {
    descriptionParts.push(`Pain Summary: ${input.painSummary}`);
  }

  return {
    dealname: `Outreach: ${input.companyName}`,
    dealstage: input.stage,
    pipeline: "default",
    description: descriptionParts.join("\n"),
  };
}

export function buildDealNoteBody(input: {
  companyName: string;
  stage: HubSpotDealStage;
  leadScore?: number | null;
  painSummary?: string | null;
  confidence?: number | null;
  outreachStatus?: string | null;
  replyClassification?: string | null;
  leadMagnetUsed?: string | null;
  recommendedChannel?: string | null;
}): string {
  const lines: string[] = [
    "Lead Intelligence Engine — lifecycle update",
    `Company: ${input.companyName}`,
    `Stage: ${input.stage}`,
  ];

  if (input.leadScore != null) {
    lines.push(`Lead Score: ${input.leadScore}`);
  }

  if (input.confidence != null) {
    lines.push(`Confidence: ${Math.round(input.confidence * 100)}%`);
  }

  if (input.recommendedChannel) {
    lines.push(`Recommended Channel: ${input.recommendedChannel}`);
  }

  if (input.leadMagnetUsed) {
    lines.push(`Lead Magnet Used: ${input.leadMagnetUsed}`);
  }

  if (input.outreachStatus) {
    lines.push(`Outreach Status: ${input.outreachStatus}`);
  }

  if (input.replyClassification) {
    lines.push(`Reply Classification: ${input.replyClassification}`);
  }

  if (input.painSummary) {
    lines.push("", `Pain Summary: ${input.painSummary}`);
  }

  return lines.join("\n");
}
