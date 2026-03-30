import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { persistLeadMagnetAsset } from "@/lib/ai/lead-magnet";
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

export function buildOutreachDraft(input: {
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
