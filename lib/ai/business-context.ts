import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const businessContextSchema = z.object({
  website_summary: z.string(),
  services_offerings: z.array(z.string()),
  customer_type: z.enum(["b2b", "b2c", "mixed", "unclear"]),
  weak_lead_capture_signals: z.array(z.string()),
  operational_clues: z.array(z.string()),
  urgency_signals: z.array(z.string()),
  decision_maker_clues: z.array(z.string()),
  tone_brand_clues: z.array(z.string()),
});

export const businessContextJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    website_summary: { type: "string" },
    services_offerings: {
      type: "array",
      items: { type: "string" },
    },
    customer_type: {
      type: "string",
      enum: ["b2b", "b2c", "mixed", "unclear"],
    },
    weak_lead_capture_signals: {
      type: "array",
      items: { type: "string" },
    },
    operational_clues: {
      type: "array",
      items: { type: "string" },
    },
    urgency_signals: {
      type: "array",
      items: { type: "string" },
    },
    decision_maker_clues: {
      type: "array",
      items: { type: "string" },
    },
    tone_brand_clues: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "website_summary",
    "services_offerings",
    "customer_type",
    "weak_lead_capture_signals",
    "operational_clues",
    "urgency_signals",
    "decision_maker_clues",
    "tone_brand_clues",
  ],
} as const;

type BusinessContextInput = {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  crawlPages: Array<{
    pageType: string;
    url: string;
    markdown?: string | null;
  }>;
};

const BUSINESS_CONTEXT_SYSTEM_PROMPT = `You are a B2B business intelligence analyst. Given website page content, extract structured context about the business.

Rules:
- Only report what is clearly supported by the page content. Never invent or assume.
- website_summary: 1-2 sentence factual summary of what the business does.
- services_offerings: List the specific services or products mentioned.
- customer_type: Classify as b2b, b2c, mixed, or unclear based on evidence.
- weak_lead_capture_signals: Note missing CTAs, no forms, no chat widget, no booking system, broken links, or other lead capture gaps. Empty array if none observed.
- operational_clues: Manual processes, team size hints, tech stack mentions, operational patterns visible on the site. Empty array if none.
- urgency_signals: Hiring notices, expansion mentions, compliance deadlines, seasonal language, recent changes. Empty array if none.
- decision_maker_clues: Founder-led signals, management team visibility, ownership structure hints. Empty array if none.
- tone_brand_clues: Professional/casual/corporate tone, brand maturity signals. Empty array if none.

Be concise and factual. Each array item should be a short 1-sentence observation.`;

export function buildFallbackBusinessContext(): z.infer<typeof businessContextSchema> {
  return {
    website_summary: "No crawl data available",
    services_offerings: [],
    customer_type: "unclear",
    weak_lead_capture_signals: [],
    operational_clues: [],
    urgency_signals: [],
    decision_maker_clues: [],
    tone_brand_clues: [],
  };
}

export async function extractBusinessContext(
  context: BusinessContextInput,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
): Promise<z.infer<typeof businessContextSchema>> {
  const crawlContent = context.crawlPages
    .filter((page) => page.markdown)
    .map((page) => `Page (${page.pageType}) ${page.url}\n${page.markdown}`)
    .join("\n\n");

  if (!crawlContent.trim()) {
    return buildFallbackBusinessContext();
  }

  const userContent = [
    `Company: ${context.companyName}`,
    context.website ? `Website: ${context.website}` : null,
    context.industry ? `Industry: ${context.industry}` : null,
    "Page content:",
    crawlContent,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_BUSINESS_CONTEXT",
    systemPrompt: BUSINESS_CONTEXT_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "business_context",
    jsonSchema: businessContextJsonSchema,
    zodSchema: businessContextSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export async function persistBusinessContext(
  companyId: string,
  context: z.infer<typeof businessContextSchema>,
) {
  const { db } = await import("@/lib/db");

  await db.businessContext.create({
    data: {
      companyId,
      websiteSummary: context.website_summary,
      servicesOfferings: context.services_offerings,
      customerType: context.customer_type,
      weakLeadCaptureSignals: context.weak_lead_capture_signals,
      operationalClues: context.operational_clues,
      urgencySignals: context.urgency_signals,
      decisionMakerClues: context.decision_maker_clues,
      toneBrandClues: context.tone_brand_clues,
      modelProvider: SourceProvider.OPENAI,
      rawPayload: context,
    },
  });

  await db.sourceEvent.create({
    data: {
      companyId,
      provider: SourceProvider.OPENAI,
      eventType: "openai.business_context",
      fieldName: "business_contexts",
      payload: context,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.OPENAI,
      stage: EnrichmentStage.BUSINESS_CONTEXT_EXTRACTION,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.business-context",
      resultSummary: {
        customer_type: context.customer_type,
        services_count: context.services_offerings.length,
      },
    },
  });
}
