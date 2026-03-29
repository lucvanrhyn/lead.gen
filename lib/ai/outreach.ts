import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

export const outreachSchema = z.object({
  email_subject_1: z.string(),
  email_subject_2: z.string(),
  cold_email_short: z.string(),
  cold_email_medium: z.string(),
  linkedin_message_safe: z.string(),
  follow_up_1: z.string(),
  follow_up_2: z.string(),
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
    email_subject_1: `${input.companyName}: ${input.leadMagnetTitle}`,
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

export async function persistOutreachDraft(
  companyId: string,
  outreach: z.infer<typeof outreachSchema>,
  contactId?: string,
) {
  const { db } = await import("@/lib/db");

  await db.outreachDraft.create({
    data: {
      companyId,
      contactId,
      emailSubject1: outreach.email_subject_1,
      emailSubject2: outreach.email_subject_2,
      coldEmailShort: outreach.cold_email_short,
      coldEmailMedium: outreach.cold_email_medium,
      linkedinMessageSafe: outreach.linkedin_message_safe,
      followUp1: outreach.follow_up_1,
      followUp2: outreach.follow_up_2,
      rawPayload: outreach,
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
      },
    },
  });
}
