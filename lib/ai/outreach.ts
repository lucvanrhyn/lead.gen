import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { persistLeadMagnetAsset } from "@/lib/ai/lead-magnet";
import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";
import {
  deriveOutreachSuppressionReason,
  summarizeCampaignAnalytics,
  type CampaignAnalytics,
  type CampaignAnalyticsInput,
  type OutreachSuppressionInput,
  type OutreachSuppressionResult,
} from "@/lib/domain/outreach-analytics";

export type {
  CampaignAnalytics,
  CampaignAnalyticsInput,
  OutreachSuppressionInput,
  OutreachSuppressionResult,
  OutreachSuppressionReason,
} from "@/lib/domain/outreach-analytics";

export const outreachSchema = z.object({
  email_subject_1: z.string(),
  email_subject_2: z.string(),
  cold_email_short: z.string(),
  cold_email_medium: z.string(),
  linkedin_message_safe: z.string(),
  follow_up_1: z.string(),
  follow_up_2: z.string(),
});

export const linkedInTaskSchema = z.object({
  lookup_status: z.enum([
    "MANUAL_LOOKUP_NEEDED",
    "READY_TO_SEND",
    "SENT",
    "REPLIED",
    "SKIPPED",
  ]),
  connection_request_note: z.string(),
  dm_message: z.string(),
  follow_up_dm: z.string(),
  lookup_hints: z.array(z.string()),
});

export const followUpDraftSchema = z.object({
  email_subject_1: z.string(),
  email_subject_2: z.string(),
  cold_email_short: z.string(),
  cold_email_medium: z.string(),
  linkedin_message_safe: z.string(),
  follow_up_1: z.string(),
  follow_up_2: z.string(),
  follow_up_reason: z.enum(["open_only", "high_intent_click", "asset_view", "reply_stop"]),
});

export const llmOutreachSchema = z.object({
  subject_lines: z.array(z.string()).min(2).max(3),
  primary_email: z.string(),
  shorter_email_variant: z.string(),
  linkedin_message: z.string(),
  follow_up_variants: z.array(z.string()).min(2).max(3),
  cta: z.string(),
  rationale_for_angle: z.string(),
});

const LLM_OUTREACH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "subject_lines",
    "primary_email",
    "shorter_email_variant",
    "linkedin_message",
    "follow_up_variants",
    "cta",
    "rationale_for_angle",
  ],
  properties: {
    subject_lines: { type: "array", items: { type: "string" } },
    primary_email: { type: "string" },
    shorter_email_variant: { type: "string" },
    linkedin_message: { type: "string" },
    follow_up_variants: { type: "array", items: { type: "string" } },
    cta: { type: "string" },
    rationale_for_angle: { type: "string" },
  },
} as const;

const LLM_OUTREACH_SYSTEM_PROMPT = `You are a B2B outreach copywriter specializing in cold email and LinkedIn messages for service businesses.

Your job: Write personalized outreach content that opens a conversation. The prospect should feel like this was written specifically for them.

Output requirements:
- subject_lines: 2-3 options. Short (under 50 chars), specific, curiosity-driven. No clickbait. No ALL CAPS. No "Quick question" or "Reaching out".
- primary_email: The full cold email body (80-150 words). Start with a specific observation about their business. Connect it to a likely pain. Offer the lead magnet as a value-first gesture. End with a low-friction CTA.
- shorter_email_variant: Same angle, 40-80 words. For follow-up or busy recipients.
- linkedin_message: 40-80 words. Professional, conversational. No pitch — just offer value.
- follow_up_variants: 2-3 different follow-up angles:
  1. Bump: Short, same thread, reference the original offer
  2. Value-add: Different angle, mention a specific insight or the lead magnet
  3. Soft close: Acknowledge silence, leave the door open gracefully
- cta: The specific call-to-action used. Must be low-friction (e.g., "Happy to send it over if useful" not "Book a call").
- rationale_for_angle: 1-2 sentences explaining why you chose this angle for this specific prospect.

Rules:
- NEVER use fake compliments ("I love your website", "Great company")
- NEVER invent facts not present in the context
- NEVER use "I noticed your company" without specifying WHAT you noticed
- NEVER use spammy phrases: "game-changer", "unlock", "skyrocket", "revolutionary"
- NEVER start with "I hope this email finds you well"
- Reference ONLY observed or inferred facts from the pain hypothesis
- The lead magnet mention should feel natural, not forced
- Use the contact's first name if available
- Keep tone professional but human — not corporate, not casual
- CTA must be easy to say yes to (reply-based, not calendar-link-based)`;

export async function generateOutreachDraft(
  input: {
    companyName: string;
    contactName?: string | null;
    contactTitle?: string | null;
    painHypothesis: {
      primary_pain: string;
      company_summary?: string;
      best_outreach_angle?: string;
      confidence_score: number;
      caution_do_not_claim?: string[];
    };
    leadMagnet: {
      title: string;
      type: string;
      suggested_outreach_mention?: string;
    };
    businessContext?: {
      website_summary: string;
      services_offerings: string[];
      customer_type: string;
    } | null;
    leadScore?: {
      total_score: number;
      recommended_action?: string;
      recommended_channel?: string;
    } | null;
    playbook?: {
      messagingFocus: string;
      ctaPreferences: string[];
      toneGuidance: string;
      doNotMention: string[];
    } | null;
    diagnosticFormCta?: {
      mode: string;
      short: string;
      medium: string;
    } | null;
  },
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
): Promise<z.infer<typeof llmOutreachSchema>> {
  const sections: string[] = [
    `Company: ${input.companyName}`,
  ];

  if (input.contactName ?? input.contactTitle) {
    const parts = [
      input.contactName ? `Name: ${input.contactName}` : null,
      input.contactTitle ? `Title: ${input.contactTitle}` : null,
    ].filter(Boolean);
    sections.push(`Contact:\n${parts.join("\n")}`);
  }

  sections.push(
    [
      "Pain Hypothesis:",
      `  primary_pain: ${input.painHypothesis.primary_pain}`,
      input.painHypothesis.company_summary
        ? `  company_summary: ${input.painHypothesis.company_summary}`
        : null,
      input.painHypothesis.best_outreach_angle
        ? `  best_outreach_angle: ${input.painHypothesis.best_outreach_angle}`
        : null,
      `  confidence_score: ${input.painHypothesis.confidence_score}`,
      input.painHypothesis.caution_do_not_claim?.length
        ? `  caution_do_not_claim: ${input.painHypothesis.caution_do_not_claim.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(
    [
      "Lead Magnet:",
      `  title: ${input.leadMagnet.title}`,
      `  type: ${input.leadMagnet.type}`,
      input.leadMagnet.suggested_outreach_mention
        ? `  suggested_outreach_mention: ${input.leadMagnet.suggested_outreach_mention}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (input.businessContext) {
    sections.push(
      [
        "Business Context:",
        `  website_summary: ${input.businessContext.website_summary}`,
        `  services_offerings: ${input.businessContext.services_offerings.join(", ")}`,
        `  customer_type: ${input.businessContext.customer_type}`,
      ].join("\n"),
    );
  }

  if (input.leadScore) {
    const parts = [
      `  total_score: ${input.leadScore.total_score}`,
      input.leadScore.recommended_action
        ? `  recommended_action: ${input.leadScore.recommended_action}`
        : null,
      input.leadScore.recommended_channel
        ? `  recommended_channel: ${input.leadScore.recommended_channel}`
        : null,
    ].filter(Boolean);
    sections.push(`Lead Score:\n${parts.join("\n")}`);
  }

  if (input.playbook) {
    sections.push(
      [
        "Playbook:",
        `  messagingFocus: ${input.playbook.messagingFocus}`,
        `  ctaPreferences: ${input.playbook.ctaPreferences.join(", ")}`,
        `  toneGuidance: ${input.playbook.toneGuidance}`,
        `  doNotMention: ${input.playbook.doNotMention.join(", ")}`,
      ].join("\n"),
    );
  }

  if (input.diagnosticFormCta) {
    sections.push(
      [
        "Diagnostic Form CTA:",
        `  mode: ${input.diagnosticFormCta.mode}`,
        `  short: ${input.diagnosticFormCta.short}`,
        `  medium: ${input.diagnosticFormCta.medium}`,
      ].join("\n"),
    );
  }

  const userContent = sections.join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_OUTREACH",
    systemPrompt: LLM_OUTREACH_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "llm_outreach",
    jsonSchema: LLM_OUTREACH_JSON_SCHEMA,
    zodSchema: llmOutreachSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export function mapLlmOutreachToOutreachSchema(
  llmOutput: z.infer<typeof llmOutreachSchema>,
): z.infer<typeof outreachSchema> {
  return outreachSchema.parse({
    email_subject_1: llmOutput.subject_lines[0],
    email_subject_2: llmOutput.subject_lines[1] ?? llmOutput.subject_lines[0],
    cold_email_short: llmOutput.shorter_email_variant,
    cold_email_medium: llmOutput.primary_email,
    linkedin_message_safe: llmOutput.linkedin_message,
    follow_up_1: llmOutput.follow_up_variants[0] ?? "",
    follow_up_2: llmOutput.follow_up_variants[1] ?? "",
  });
}

export function buildOutreachDraftTemplate(input: {
  companyName: string;
  contactName?: string;
  pain: string;
  leadMagnetTitle: string;
  serviceAngle: string;
  diagnosticFormCta?: {
    mode: "lead_magnet_only" | "form_only" | "lead_magnet_and_form";
    short: string;
    medium: string;
  };
}) {
  const introName = input.contactName ? `${input.contactName}, ` : "";
  const shortCta =
    input.diagnosticFormCta?.mode === "form_only"
      ? input.diagnosticFormCta.short
      : `I put together a short ${input.leadMagnetTitle} for ${input.companyName} after noticing a likely issue around ${input.pain.toLowerCase()}. If useful, I can send it over.`;
  const mediumCta =
    input.diagnosticFormCta?.mode === "form_only"
      ? input.diagnosticFormCta.medium
      : input.diagnosticFormCta?.mode === "lead_magnet_and_form"
        ? `I drafted a concise ${input.leadMagnetTitle} and a short workflow diagnostic focused on ${input.pain.toLowerCase()} so the next recommendation can be practical.`
        : `I spent some time reviewing the public footprint for ${input.companyName}. There looks to be a real opportunity around ${input.pain.toLowerCase()}. I drafted a concise ${input.leadMagnetTitle} that focuses on ${input.serviceAngle.toLowerCase()}. Happy to send it if that would be useful.`;

  return outreachSchema.parse({
    email_subject_1: input.leadMagnetTitle,
    email_subject_2: `A quick idea on ${input.pain.toLowerCase()}`,
    cold_email_short: `${introName}${shortCta}`,
    cold_email_medium: `${introName}${mediumCta}`,
    linkedin_message_safe:
      input.diagnosticFormCta?.mode === "form_only"
        ? `${input.diagnosticFormCta.short} Happy to share it if helpful.`
        : `I put together a short ${input.leadMagnetTitle} for ${input.companyName} focused on ${input.pain.toLowerCase()}. Happy to share it if helpful.`,
    follow_up_1:
      input.diagnosticFormCta?.mode === "form_only"
        ? `Following up in case the short workflow diagnostic would be useful for ${input.companyName}.`
        : `Following up in case the ${input.leadMagnetTitle} would be useful for ${input.companyName}.`,
    follow_up_2: `Happy to send over the ${input.leadMagnetTitle} if improving ${input.pain.toLowerCase()} is on your radar.`,
  });
}

/** @deprecated Use buildOutreachDraftTemplate or generateOutreachDraft */
export const buildOutreachDraft = buildOutreachDraftTemplate;

export function buildLinkedInTask(input: {
  companyName: string;
  contactName?: string;
  contactTitle?: string | null;
  leadMagnetTitle: string;
  linkedinMessageSafe: string;
  followUp2: string;
}) {
  const introName = input.contactName ? `${input.contactName}, ` : "";
  const titleHint = input.contactTitle ? `${input.contactTitle} at ${input.companyName}` : input.companyName;

  return linkedInTaskSchema.parse({
    lookup_status: "MANUAL_LOOKUP_NEEDED",
    connection_request_note: `${introName}I put together a short ${input.leadMagnetTitle} after spotting a likely friction point at ${input.companyName}. Thought it may be relevant to your work as ${titleHint}.`,
    dm_message: input.linkedinMessageSafe,
    follow_up_dm: input.followUp2,
    lookup_hints: [
      input.contactName ? `${input.contactName} ${input.companyName} LinkedIn` : `${input.companyName} LinkedIn`,
      input.contactTitle ? `${input.contactTitle} ${input.companyName} LinkedIn` : `${input.companyName} owner LinkedIn`,
    ],
  });
}

export function buildFollowUpDraft(input: {
  companyName: string;
  contactName?: string;
  leadMagnetTitle: string;
  engagementType: "OPEN" | "CLICK" | "ASSET_VIEW";
}) {
  const introName = input.contactName ? `${input.contactName}, ` : "";

  if (input.engagementType === "CLICK") {
    return followUpDraftSchema.parse({
      email_subject_1: `${input.companyName} follow-up`,
      email_subject_2: `Checking in on the ${input.leadMagnetTitle}`,
      cold_email_short: `${introName}Quick follow-up in case the ${input.leadMagnetTitle} sparked any ideas.`,
      cold_email_medium: `${introName}I noticed someone checked out the ${input.leadMagnetTitle}, so I wanted to follow up while it is still fresh. If helpful, I can tighten it into a more specific recommendation for ${input.companyName}.`,
      linkedin_message_safe: `Quick follow-up on the ${input.leadMagnetTitle} in case it was useful.`,
      follow_up_1: `Following up while the ${input.leadMagnetTitle} is still fresh.`,
      follow_up_2: `Happy to tailor the next recommendation if the current bottleneck is still a priority.`,
      follow_up_reason: "high_intent_click",
    });
  }

  if (input.engagementType === "ASSET_VIEW") {
    return followUpDraftSchema.parse({
      email_subject_1: `${input.companyName} asset follow-up`,
      email_subject_2: `A quick note on the asset view`,
      cold_email_short: `${introName}Saw the asset got viewed, so I wanted to send a short follow-up.`,
      cold_email_medium: `${introName}It looks like the lead magnet was viewed, so I wanted to follow up with a short practical next step for ${input.companyName} rather than leave it hanging.`,
      linkedin_message_safe: `Saw the asset was viewed and wanted to follow up with one practical next step.`,
      follow_up_1: `Following up after the asset view in case a practical next step would help.`,
      follow_up_2: `Happy to turn the asset into a more concrete recommendation if useful.`,
      follow_up_reason: "asset_view",
    });
  }

  return followUpDraftSchema.parse({
    email_subject_1: `${input.companyName} follow-up`,
    email_subject_2: `Quick follow-up on the ${input.leadMagnetTitle}`,
    cold_email_short: `${introName}Just following up in case the ${input.leadMagnetTitle} is relevant.`,
    cold_email_medium: `${introName}I noticed the earlier note was opened and wanted to follow up with one shorter nudge. If the ${input.leadMagnetTitle} is relevant, I can send the most practical version for ${input.companyName}.`,
    linkedin_message_safe: `Quick follow-up in case the ${input.leadMagnetTitle} is relevant.`,
    follow_up_1: `Following up in case the ${input.leadMagnetTitle} would be useful.`,
    follow_up_2: `Happy to send the short version if it would help.`,
    follow_up_reason: "open_only",
  });
}

export function evaluateOutreachSuppression(input: OutreachSuppressionInput): OutreachSuppressionResult {
  return deriveOutreachSuppressionReason(input);
}

export function buildCampaignAnalytics(input: CampaignAnalyticsInput): CampaignAnalytics {
  return summarizeCampaignAnalytics(input);
}

export async function persistOutreachDraft(
  input: {
    companyId: string;
    companyName: string;
    leadMagnet: {
      id: string;
      title: string;
      summary: string;
      whyItMatchesTheLead: string;
      suggestedDeliveryFormat: string;
    };
    outreach: z.infer<typeof outreachSchema>;
    diagnosticFormUrl?: string | null;
    contact?: {
      id?: string;
      fullName?: string | null;
      title?: string | null;
    };
  },
) {
  const { companyId, companyName, leadMagnet, outreach, contact, diagnosticFormUrl } = input;
  const { db } = await import("@/lib/db");

  const draft = await db.outreachDraft.create({
    data: {
      companyId,
      contactId: contact?.id,
      emailSubject1: outreach.email_subject_1,
      emailSubject2: outreach.email_subject_2,
      coldEmailShort: outreach.cold_email_short,
      coldEmailMedium: outreach.cold_email_medium,
      linkedinMessageSafe: outreach.linkedin_message_safe,
      followUp1: outreach.follow_up_1,
      followUp2: outreach.follow_up_2,
      approvalStatus: "PENDING_APPROVAL",
      rawPayload: outreach,
    },
  });

  await persistLeadMagnetAsset({
    companyId,
    leadMagnetId: leadMagnet.id,
    outreachDraftId: draft.id,
    companyName,
    leadMagnetTitle: leadMagnet.title,
    leadMagnetSummary: leadMagnet.summary,
    diagnosticFormUrl,
  });

  const linkedInTask = buildLinkedInTask({
    companyName,
    contactName: contact?.fullName ?? undefined,
    contactTitle: contact?.title ?? undefined,
    leadMagnetTitle: leadMagnet.title,
    linkedinMessageSafe: outreach.linkedin_message_safe,
    followUp2: outreach.follow_up_2,
  });

  await db.linkedInTask.create({
    data: {
      companyId,
      contactId: contact?.id,
      outreachDraftId: draft.id,
      status: linkedInTask.lookup_status,
      contactName: contact?.fullName ?? undefined,
      contactTitle: contact?.title ?? undefined,
      lookupHints: linkedInTask.lookup_hints,
      connectionRequestNote: linkedInTask.connection_request_note,
      dmMessage: linkedInTask.dm_message,
      followUpDm: linkedInTask.follow_up_dm,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.SYSTEM,
      stage: EnrichmentStage.OUTREACH_GENERATION,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.outreach",
      resultSummary: {
        primary_subject: outreach.email_subject_1,
        linkedin_lookup_status: linkedInTask.lookup_status,
      },
    },
  });

  return draft;
}
