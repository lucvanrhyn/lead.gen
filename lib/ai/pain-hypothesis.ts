import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

export const painHypothesisSchema = z.object({
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
  technologyProfiles: Array<{
    technologyName: string;
    category?: string | null;
    confidence?: number | null;
  }>;
  newsMentions: Array<{
    title: string;
    articleUrl: string;
    summary?: string | null;
  }>;
};

function getOpenAiApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.OPENAI_API_KEY;

  if (!resolved) {
    throw new Error("OpenAI API key is required for pain hypothesis generation.");
  }

  return resolved;
}

function buildEvidenceContext(context: PainHypothesisContext) {
  const crawlEvidence = context.crawlPages
    .filter((page) => page.markdown)
    .map((page) => `Page (${page.pageType}) ${page.url}\n${page.markdown}`)
    .join("\n\n");

  const technologyEvidence = context.technologyProfiles
    .map(
      (profile) =>
        `Technology ${profile.technologyName}${profile.category ? ` (${profile.category})` : ""} confidence ${profile.confidence ?? "--"}`,
    )
    .join("\n");

  const newsEvidence = context.newsMentions
    .map((mention) => `${mention.title} - ${mention.articleUrl}\n${mention.summary ?? ""}`)
    .join("\n\n");

  return [crawlEvidence, technologyEvidence, newsEvidence].filter(Boolean).join("\n\n");
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
  };
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  return null;
}

export async function generatePainHypothesis(
  context: PainHypothesisContext,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
) {
  const evidenceContext = buildEvidenceContext(context);

  if (!evidenceContext.trim()) {
    return buildInsufficientEvidencePainHypothesis(context.companyName);
  }

  const apiKey = getOpenAiApiKey(options?.apiKey);
  const fetchFn = options?.fetchFn ?? fetch;
  const response = await fetchFn("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_PAIN_HYPOTHESIS ?? "gpt-5.4",
      input: [
        {
          role: "system",
          content:
            "You generate evidence-backed B2B pain hypotheses. Never invent evidence. Every pain must cite public signals only. If evidence is weak, reduce confidence and say so explicitly.",
        },
        {
          role: "user",
          content: [
            `Company: ${context.companyName}`,
            context.website ? `Website: ${context.website}` : null,
            context.industry ? `Industry: ${context.industry}` : null,
            "Public evidence:",
            evidenceContext,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pain_hypothesis",
          strict: true,
          schema: painHypothesisJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI pain hypothesis request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI response did not contain structured output text.");
  }

  return painHypothesisSchema.parse(JSON.parse(outputText));
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
