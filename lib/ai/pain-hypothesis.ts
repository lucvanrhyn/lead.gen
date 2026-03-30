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
};

function getOpenAiApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.OPENAI_API_KEY;

  if (!resolved) {
    throw new Error("OpenAI API key is required for pain hypothesis generation.");
  }

  return resolved;
}

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

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const outputItem of payload.output) {
      if (
        outputItem &&
        typeof outputItem === "object" &&
        "content" in outputItem &&
        Array.isArray(outputItem.content)
      ) {
        for (const contentItem of outputItem.content) {
          if (
            contentItem &&
            typeof contentItem === "object" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return contentItem.text;
          }

          if (
            contentItem &&
            typeof contentItem === "object" &&
            "parsed" in contentItem &&
            contentItem.parsed &&
            typeof contentItem.parsed === "object"
          ) {
            return JSON.stringify(contentItem.parsed);
          }
        }
      }
    }
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
  const model = process.env.OPENAI_MODEL_PAIN_HYPOTHESIS ?? "gpt-4o";

  const body = JSON.stringify({
    model,
    input: [
      {
        role: "system",
        content: `You are a B2B sales intelligence agent that analyses public evidence to identify the most likely pain point a company is experiencing and assess lead quality.

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

The recommended_service_angle must be a concrete, 1-sentence value proposition that connects the pain to a service offering.`,
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
  });

  // Retry up to 3 times with backoff on rate limit or server errors.
  let response: Response | undefined;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.ok) break;

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`OpenAI pain hypothesis request failed with status ${response.status}.`);

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
    }

    break;
  }

  if (!response?.ok) {
    throw lastError ?? new Error(`OpenAI pain hypothesis request failed with status ${response?.status}.`);
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
