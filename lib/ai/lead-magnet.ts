import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const leadMagnetSchema = z.object({
  title: z.string(),
  type: z.string(),
  summary: z.string(),
  why_it_matches_the_lead: z.string(),
  suggested_delivery_format: z.string(),
  estimated_time_to_prepare: z.string(),
  suggested_outreach_mention: z.string(),
  content_body: z.string(),
});

const leadMagnetJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    type: { type: "string" },
    summary: { type: "string" },
    why_it_matches_the_lead: { type: "string" },
    suggested_delivery_format: { type: "string" },
    estimated_time_to_prepare: { type: "string" },
    suggested_outreach_mention: { type: "string" },
    content_body: { type: "string" },
  },
  required: [
    "title",
    "type",
    "summary",
    "why_it_matches_the_lead",
    "suggested_delivery_format",
    "estimated_time_to_prepare",
    "suggested_outreach_mention",
    "content_body",
  ],
} as const;

const LEAD_MAGNET_SYSTEM_PROMPT = `You are a B2B lead generation specialist creating personalized lead magnets for outreach campaigns.

Your job: design a specific, high-value lead magnet that a service business can deliver to a prospect within 1-2 hours to open a sales conversation.

Lead magnet types you can recommend:
- "website conversion teardown" — for businesses with poor online conversion; delivered as a 5-slide annotated PDF
- "booking-flow audit" — for businesses losing bookings online; delivered as annotated Loom + PDF
- "automation opportunity snapshot" — for businesses spending time on manual tasks; delivered as a 1-page brief
- "cost-per-lead analysis" — for businesses running paid ads without tracking; delivered as a 1-page benchmark report
- "compliance gap review" — for regulated industries with potential liability exposure; delivered as a checklist PDF
- "pricing strategy teardown" — for businesses whose pricing undercuts their value; delivered as a 1-page analysis
- "referral system audit" — for service businesses that rely on word-of-mouth; delivered as a framework PDF
- "local SEO audit" — for businesses with poor local search visibility; delivered as a simple report
- "checklist" — actionable step-by-step checklist for a specific operational improvement
- "mini audit" — focused review of one specific business area with findings and recommendations
- "scorecard" — self-assessment tool the prospect can use to benchmark themselves
- "benchmark summary" — industry comparison showing where the prospect stands vs peers
- "question framework" — diagnostic questions that help the prospect identify their own gaps
- "google form diagnostic" — interactive diagnostic form that qualifies and educates simultaneously
- "research follow-up" — when evidence is insufficient; delivered as a plain-text evidence memo

Rules:
- Be SPECIFIC to the company's actual pain — mention their industry, the problem, and the exact outcome the lead magnet delivers
- The title must include the company name and be compelling (not generic)
- The summary must explain exactly what insights the prospect will receive and why it matters to THEM
- why_it_matches_the_lead must reference the specific pain evidence and service angle — make it clear this was made for them
- suggested_delivery_format must be concrete (e.g. "5-slide annotated PDF", "recorded Loom walkthrough + 1-page PDF")
- estimated_time_to_prepare should be realistic (20-75 minutes)
- suggested_outreach_mention: A natural 1-sentence hook for the outreach email to reference this lead magnet. It should feel conversational, not salesy. Example: "I put together a quick booking flow review for your practice — spotted a couple of things that might be costing you appointments."
- content_body: For simpler formats (checklist, scorecard, question framework), provide the actual content. For complex formats (teardown, audit), provide a detailed outline of what would be included. This should be substantive — 200-500 words.`;

export async function buildLeadMagnet(
  input: {
    companyName: string;
    industry?: string | null;
    primaryPain: string;
    recommendedLeadMagnetType: string;
    recommendedServiceAngle: string;
    insufficientEvidence: boolean;
  },
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
    playbook?: {
      preferredLeadMagnetTypes: string[];
      offerAngles: string[];
      messagingFocus: string;
    } | null;
  },
) {
  if (input.insufficientEvidence) {
    return leadMagnetSchema.parse({
      title: `${input.companyName} Research Follow-Up`,
      type: "research follow-up",
      summary: `A short evidence memo outlining what is still needed before making a confident recommendation for ${input.companyName}.`,
      why_it_matches_the_lead:
        "The current public evidence is too thin for a confident recommendation, so the best next asset is a research follow-up.",
      suggested_delivery_format: "Plain-text evidence memo",
      estimated_time_to_prepare: "20 minutes",
      suggested_outreach_mention: `I've been researching ${input.companyName} and have a few observations to share when the timing is right.`,
      content_body: "",
    });
  }

  const playbookLines =
    options?.playbook
      ? [
          "Industry playbook context:",
          `- Preferred lead magnet types: ${options.playbook.preferredLeadMagnetTypes.join(", ")}`,
          `- Offer angles: ${options.playbook.offerAngles.join(", ")}`,
          `- Messaging focus: ${options.playbook.messagingFocus}`,
        ]
      : [];

  const userContent = [
    `Company: ${input.companyName}`,
    input.industry ? `Industry: ${input.industry}` : null,
    `Primary pain: ${input.primaryPain}`,
    `Recommended lead magnet type: ${input.recommendedLeadMagnetType}`,
    `Service angle: ${input.recommendedServiceAngle}`,
    "Design a specific, personalised lead magnet for this company. Make the title, summary, and rationale specific to their situation — not generic.",
    ...playbookLines,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_PAIN_HYPOTHESIS",
    systemPrompt: LEAD_MAGNET_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "lead_magnet",
    jsonSchema: leadMagnetJsonSchema,
    zodSchema: leadMagnetSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildLeadMagnetAssetSlug(input: {
  companyName: string;
  leadMagnetTitle: string;
  outreachDraftId: string;
}) {
  const companySegment = slugifySegment(input.companyName);
  const leadMagnetSegment = slugifySegment(input.leadMagnetTitle);
  const idSegment = slugifySegment(input.outreachDraftId).slice(0, 12);

  return [companySegment, leadMagnetSegment, idSegment].filter(Boolean).join("-");
}

export async function persistLeadMagnet(
  companyId: string,
  leadMagnet: z.infer<typeof leadMagnetSchema>,
) {
  const { db } = await import("@/lib/db");

  const record = await db.leadMagnet.create({
    data: {
      companyId,
      title: leadMagnet.title,
      type: leadMagnet.type,
      summary: leadMagnet.summary,
      whyItMatchesTheLead: leadMagnet.why_it_matches_the_lead,
      suggestedDeliveryFormat: leadMagnet.suggested_delivery_format,
      estimatedTimeToPrepare: leadMagnet.estimated_time_to_prepare,
      suggestedOutreachMention: leadMagnet.suggested_outreach_mention,
      contentBody: leadMagnet.content_body || null,
      rawPayload: leadMagnet,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.OPENAI,
      stage: EnrichmentStage.LEAD_MAGNET_GENERATION,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.lead-magnet",
      resultSummary: {
        lead_magnet_type: leadMagnet.type,
      },
    },
  });

  return record;
}

export async function persistLeadMagnetAsset(input: {
  companyId: string;
  leadMagnetId: string;
  outreachDraftId: string;
  companyName: string;
  leadMagnetTitle: string;
  leadMagnetSummary: string;
  diagnosticFormUrl?: string | null;
}) {
  const { db } = await import("@/lib/db");
  const slug = buildLeadMagnetAssetSlug({
    companyName: input.companyName,
    leadMagnetTitle: input.leadMagnetTitle,
    outreachDraftId: input.outreachDraftId,
  });

  return db.leadMagnetAsset.upsert({
    where: { outreachDraftId: input.outreachDraftId },
    create: {
      companyId: input.companyId,
      leadMagnetId: input.leadMagnetId,
      outreachDraftId: input.outreachDraftId,
      slug,
      headline: input.leadMagnetTitle,
      intro: input.leadMagnetSummary,
      diagnosticFormUrl: input.diagnosticFormUrl ?? undefined,
    },
    update: {
      slug,
      headline: input.leadMagnetTitle,
      intro: input.leadMagnetSummary,
      diagnosticFormUrl: input.diagnosticFormUrl ?? undefined,
      status: "ACTIVE",
    },
  });
}
