import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

export const leadMagnetSchema = z.object({
  title: z.string(),
  type: z.string(),
  summary: z.string(),
  why_it_matches_the_lead: z.string(),
  suggested_delivery_format: z.string(),
  estimated_time_to_prepare: z.string(),
});

const leadMagnetFormatByType: Record<string, { format: string; prepTime: string }> = {
  "website conversion teardown": { format: "5-slide PDF", prepTime: "45 minutes" },
  "booking-flow audit": { format: "Annotated Loom + PDF notes", prepTime: "60 minutes" },
  "automation opportunity snapshot": { format: "1-page PDF brief", prepTime: "35 minutes" },
  "research follow-up": { format: "Plain-text evidence memo", prepTime: "20 minutes" },
};

export function buildLeadMagnet(input: {
  companyName: string;
  primaryPain: string;
  recommendedLeadMagnetType: string;
  recommendedServiceAngle: string;
  insufficientEvidence: boolean;
}) {
  const type = input.insufficientEvidence
    ? "research follow-up"
    : input.recommendedLeadMagnetType;
  const delivery = leadMagnetFormatByType[type] ?? {
    format: "1-page PDF brief",
    prepTime: "30 minutes",
  };

  return leadMagnetSchema.parse({
    title: `${input.companyName} ${type.replace(/\b\w/g, (match) => match.toUpperCase())}`,
    type,
    summary: input.insufficientEvidence
      ? `A short evidence memo outlining what is still needed before making a confident recommendation for ${input.companyName}.`
      : `A concise, personalized ${type} focused on ${input.primaryPain.toLowerCase()}.`,
    why_it_matches_the_lead: input.insufficientEvidence
      ? "The current public evidence is too thin for a confident recommendation, so the best next asset is a research follow-up."
      : input.recommendedServiceAngle,
    suggested_delivery_format: delivery.format,
    estimated_time_to_prepare: delivery.prepTime,
  });
}

export async function persistLeadMagnet(
  companyId: string,
  leadMagnet: z.infer<typeof leadMagnetSchema>,
) {
  const { db } = await import("@/lib/db");

  await db.leadMagnet.create({
    data: {
      companyId,
      title: leadMagnet.title,
      type: leadMagnet.type,
      summary: leadMagnet.summary,
      whyItMatchesTheLead: leadMagnet.why_it_matches_the_lead,
      suggestedDeliveryFormat: leadMagnet.suggested_delivery_format,
      estimatedTimeToPrepare: leadMagnet.estimated_time_to_prepare,
      rawPayload: leadMagnet,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.SYSTEM,
      stage: EnrichmentStage.LEAD_MAGNET_GENERATION,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.lead-magnet",
      resultSummary: {
        lead_magnet_type: leadMagnet.type,
      },
    },
  });
}
