import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const painHypothesisSchema = z.object({
  // Existing fields (backward compat)
  primary_pain: z.string(),
  secondary_pains: z.array(z.string()),
  evidence: z.array(
    z.object({
      source_type: z.string(),
      source_url: z.string(),
      snippet: z.string(),
      signal_type: z.string(),
      confidence: z.number(),
    }),
  ),
  business_impact: z.string(),
  confidence_score: z.number(),
  recommended_service_angle: z.string(),
  recommended_lead_magnet_type: z.string(),
  insufficient_evidence: z.boolean(),
  // New structured fields
  company_summary: z.string(),
  observed_signals: z.array(
    z.object({
      signal: z.string(),
      source: z.string(),
      confidence: z.number(),
      category: z.enum(["observed", "inferred", "speculative"]),
    }),
  ),
  likely_pains: z.array(
    z.object({
      pain: z.string(),
      category: z.enum(["observed", "inferred", "speculative"]),
      evidence_refs: z.array(z.string()),
    }),
  ),
  best_outreach_angle: z.string(),
  caution_do_not_claim: z.array(z.string()),
});

export const painHypothesisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primary_pain: { type: "string" },
    secondary_pains: {
      type: "array",
      items: { type: "string" },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source_type: { type: "string" },
          source_url: { type: "string" },
          snippet: { type: "string" },
          signal_type: { type: "string" },
          confidence: { type: "number" },
        },
        required: [
          "source_type",
          "source_url",
          "snippet",
          "signal_type",
          "confidence",
        ],
      },
    },
    business_impact: { type: "string" },
    confidence_score: { type: "number" },
    recommended_service_angle: { type: "string" },
    recommended_lead_magnet_type: { type: "string" },
    insufficient_evidence: { type: "boolean" },
    company_summary: { type: "string" },
    observed_signals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          signal: { type: "string" },
          source: { type: "string" },
          confidence: { type: "number" },
          category: { type: "string", enum: ["observed", "inferred", "speculative"] },
        },
        required: ["signal", "source", "confidence", "category"],
      },
    },
    likely_pains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pain: { type: "string" },
          category: { type: "string", enum: ["observed", "inferred", "speculative"] },
          evidence_refs: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["pain", "category", "evidence_refs"],
      },
    },
    best_outreach_angle: { type: "string" },
    caution_do_not_claim: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "primary_pain",
    "secondary_pains",
    "evidence",
    "business_impact",
    "confidence_score",
    "recommended_service_angle",
    "recommended_lead_magnet_type",
    "insufficient_evidence",
    "company_summary",
    "observed_signals",
    "likely_pains",
    "best_outreach_angle",
    "caution_do_not_claim",
  ],
} as const;

type EvidenceInput = {
  sourceType: string;
  sourceUrl: string;
  snippet: string;
  signalType: string;
  confidence: number;
};

type PainHypothesisContext = {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  crawlPages: Array<{
    pageType: string;
    url: string;
    markdown?: string | null;
  }>;
};

const PAIN_HYPOTHESIS_SYSTEM_PROMPT = `You are a B2B sales intelligence agent that analyses public evidence to identify the most likely pain point a company is experiencing and assess lead quality.

Your output must be evidence-backed. Never invent evidence. Every claim must cite public signals only.

Lead quality assessment rules:
- High confidence (0.7–1.0): Website clearly signals the pain, shows operational friction, or describes unmet needs. Multiple evidence sources agree.
- Medium confidence (0.4–0.69): One clear signal from the website or an indirect indicator. Pain is plausible but not confirmed.
- Low confidence (0.18–0.39): Thin evidence. Website is minimal or generic. Set insufficient_evidence=true if you cannot identify a specific, actionable pain.

Recommended lead magnet types (choose the one that directly addresses the identified pain):
- "website conversion teardown" — weak/confusing online presence
- "booking-flow audit" — friction in booking or scheduling
- "automation opportunity snapshot" — manual, repetitive workflows visible on the site
- "cost-per-lead analysis" — paid advertising spend without clear tracking
- "compliance gap review" — regulated industry with potential liability exposure
- "pricing strategy teardown" — pricing that undersells the service quality
- "referral system audit" — service business relying heavily on referrals
- "local SEO audit" — poor local search visibility
- "research follow-up" — insufficient evidence to identify a specific pain

The recommended_service_angle must be a concrete, 1-sentence value proposition that connects the pain to a service offering.

## Structured reasoning framework

You MUST explicitly categorize every signal and pain point:
- "observed": Directly stated or clearly visible on the website (e.g., "No booking form on contact page")
- "inferred": Reasonable conclusion from observed evidence (e.g., "Likely losing bookings because contact page only has a phone number")
- "speculative": Possible but not directly supported (e.g., "May be experiencing staff scheduling issues")

For company_summary: Write a factual 1-2 sentence description of what the business does, based only on what you can see.

For observed_signals: List each distinct signal with its source URL and your confidence.

For likely_pains: List each pain point with its category and which observed_signals support it.

For best_outreach_angle: The single most promising angle for a cold outreach message.

For caution_do_not_claim: List anything that should NOT be stated as fact in outreach (things you inferred or speculated about).`;

function buildEvidenceContext(context: PainHypothesisContext) {
  return context.crawlPages
    .filter((page) => page.markdown)
    .map((page) => `Page (${page.pageType}) ${page.url}\n${page.markdown}`)
    .join("\n\n");
}

export function buildInsufficientEvidencePainHypothesis(companyName: string) {
  return {
    primary_pain: `Insufficient public evidence to identify a confident pain for ${companyName}`,
    secondary_pains: [],
    evidence: [],
    business_impact:
      "Not enough public evidence is available yet to estimate business impact confidently.",
    confidence_score: 0.18,
    recommended_service_angle: "Gather more public evidence before recommending a service angle.",
    recommended_lead_magnet_type: "research follow-up",
    insufficient_evidence: true,
    company_summary: `Insufficient data available for ${companyName}`,
    observed_signals: [],
    likely_pains: [],
    best_outreach_angle: "Gather more evidence before crafting an outreach angle.",
    caution_do_not_claim: ["All claims about this company — insufficient evidence available."],
  };
}

export async function generatePainHypothesis(
  context: PainHypothesisContext,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
    businessContext?: {
      website_summary: string;
      services_offerings: string[];
      customer_type: string;
      urgency_signals: string[];
    } | null;
    playbook?: {
      commonPains: string[];
      offerAngles: string[];
      messagingFocus: string;
    } | null;
  },
) {
  const evidenceContext = buildEvidenceContext(context);

  if (!evidenceContext.trim()) {
    return buildInsufficientEvidencePainHypothesis(context.companyName);
  }

  const parts: (string | null)[] = [
    `Company: ${context.companyName}`,
    context.website ? `Website: ${context.website}` : null,
    context.industry ? `Industry: ${context.industry}` : null,
    "Public evidence:",
    evidenceContext,
  ];

  if (options?.businessContext) {
    const bc = options.businessContext;
    parts.push(
      [
        "Business context (pre-extracted):",
        `- Summary: ${bc.website_summary}`,
        `- Services: ${bc.services_offerings.join(", ")}`,
        `- Customer type: ${bc.customer_type}`,
        `- Urgency signals: ${bc.urgency_signals.join(", ")}`,
      ].join("\n"),
    );
  }

  if (options?.playbook) {
    const pb = options.playbook;
    parts.push(
      [
        "Industry playbook context:",
        `- Common pains in this industry: ${pb.commonPains.join(", ")}`,
        `- Offer angles: ${pb.offerAngles.join(", ")}`,
        `- Messaging focus: ${pb.messagingFocus}`,
      ].join("\n"),
    );
  }

  const userContent = parts.filter(Boolean).join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_PAIN_HYPOTHESIS",
    systemPrompt: PAIN_HYPOTHESIS_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "pain_hypothesis",
    jsonSchema: painHypothesisJsonSchema,
    zodSchema: painHypothesisSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export async function persistPainHypothesis(
  companyId: string,
  hypothesis: z.infer<typeof painHypothesisSchema>,
) {
  const { db } = await import("@/lib/db");

  await db.painHypothesis.create({
    data: {
      companyId,
      primaryPain: hypothesis.primary_pain,
      secondaryPains: hypothesis.secondary_pains,
      evidence: hypothesis.evidence,
      businessImpact: hypothesis.business_impact,
      confidenceScore: hypothesis.confidence_score,
      recommendedServiceAngle: hypothesis.recommended_service_angle,
      recommendedLeadMagnetType: hypothesis.recommended_lead_magnet_type,
      insufficientEvidence: hypothesis.insufficient_evidence,
      companySummary: hypothesis.company_summary,
      observedFacts: hypothesis.observed_signals,
      reasonableInferences: hypothesis.likely_pains.filter((p) => p.category === "inferred"),
      speculativeAssumptions: hypothesis.likely_pains.filter((p) => p.category === "speculative"),
      bestOutreachAngle: hypothesis.best_outreach_angle,
      cautionNotes: hypothesis.caution_do_not_claim,
      modelProvider: SourceProvider.OPENAI,
      rawPayload: hypothesis,
    },
  });

  await db.sourceEvent.create({
    data: {
      companyId,
      provider: SourceProvider.OPENAI,
      eventType: "openai.pain_hypothesis",
      fieldName: "pain_hypotheses",
      confidence: hypothesis.confidence_score,
      payload: hypothesis,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.OPENAI,
      stage: EnrichmentStage.PAIN_HYPOTHESIS_GENERATION,
      status: hypothesis.insufficient_evidence ? JobStatus.PARTIAL : JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.pain-hypothesis",
      resultSummary: {
        confidence_score: hypothesis.confidence_score,
        insufficient_evidence: hypothesis.insufficient_evidence,
      },
    },
  });
}

export function collectPainEvidenceSummary(evidence: EvidenceInput[]) {
  return evidence.map((item) => `${item.sourceType}: ${item.snippet}`).join("\n");
}
