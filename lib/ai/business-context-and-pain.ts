import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";
import {
  businessContextSchema,
  buildFallbackBusinessContext,
  type businessContextJsonSchema as BusinessContextJsonSchemaType,
} from "@/lib/ai/business-context";
import {
  painHypothesisSchema,
  buildInsufficientEvidencePainHypothesis,
} from "@/lib/ai/pain-hypothesis";

// ---------------------------------------------------------------------------
// Combined schema: wraps both outputs in a single object
// ---------------------------------------------------------------------------

export const businessContextAndPainSchema = z.object({
  business_context: businessContextSchema,
  pain_hypothesis: painHypothesisSchema,
});

export type BusinessContextAndPain = z.infer<typeof businessContextAndPainSchema>;

// JSON Schema for OpenAI structured output (must mirror the Zod schema exactly)
import { businessContextJsonSchema } from "@/lib/ai/business-context";
import { painHypothesisJsonSchema } from "@/lib/ai/pain-hypothesis";

export const businessContextAndPainJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    business_context: businessContextJsonSchema,
    pain_hypothesis: painHypothesisJsonSchema,
  },
  required: ["business_context", "pain_hypothesis"],
} as const;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

type CombinedContextInput = {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  crawlPages: Array<{
    pageType: string;
    url: string;
    markdown?: string | null;
  }>;
};

type CombinedContextOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  playbook?: {
    commonPains: string[];
    offerAngles: string[];
    messagingFocus: string;
  } | null;
  reviewSignals?: {
    averageRating: number | null;
    reviewCount: number;
    negativeExcerpts: string[];
    complaintThemes: string[];
    summary: string;
  } | null;
};

// ---------------------------------------------------------------------------
// System prompt — asks the LLM to produce both outputs in one call
// ---------------------------------------------------------------------------

const COMBINED_SYSTEM_PROMPT = `You are a B2B business intelligence and sales intelligence analyst. Given website page content, you must produce TWO structured analyses in a single response.

## Part 1 — Business Context

Extract structured context about the business:
- website_summary: 1-2 sentence factual summary of what the business does.
- services_offerings: List the specific services or products mentioned.
- customer_type: Classify as b2b, b2c, mixed, or unclear based on evidence.
- weak_lead_capture_signals: Note missing CTAs, no forms, no chat widget, no booking system, broken links, or other lead capture gaps. Empty array if none observed.
- operational_clues: Manual processes, team size hints, tech stack mentions, operational patterns visible on the site. Empty array if none.
- urgency_signals: Hiring notices, expansion mentions, compliance deadlines, seasonal language, recent changes. Empty array if none.
- decision_maker_clues: Founder-led signals, management team visibility, ownership structure hints. Empty array if none.
- tone_brand_clues: Professional/casual/corporate tone, brand maturity signals. Empty array if none.

## Part 2 — Pain Hypothesis

Using the business context you just extracted, identify the most likely pain point:

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

Categorize every signal and pain point:
- "observed": Directly stated or clearly visible on the website
- "inferred": Reasonable conclusion from observed evidence
- "speculative": Possible but not directly supported

For company_summary: Write a factual 1-2 sentence description of what the business does, based only on what you can see.
For observed_signals: List each distinct signal with its source URL and your confidence.
For likely_pains: List each pain point with its category and which observed_signals support it.
For best_outreach_angle: The single most promising angle for a cold outreach message.
For caution_do_not_claim: List anything that should NOT be stated as fact in outreach.

Rules:
- Only report what is clearly supported by the page content. Never invent or assume.
- Be concise and factual. Each array item should be a short 1-sentence observation.
- The pain hypothesis should leverage the business context you extracted — do not analyse the pages independently.`;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

function buildCrawlContent(
  crawlPages: CombinedContextInput["crawlPages"],
): string {
  return crawlPages
    .filter((page) => page.markdown)
    .map((page) => `Page (${page.pageType}) ${page.url}\n${page.markdown}`)
    .join("\n\n");
}

function buildUserContent(
  context: CombinedContextInput,
  crawlContent: string,
  playbook: CombinedContextOptions["playbook"],
  reviewSignals?: CombinedContextOptions["reviewSignals"],
): string {
  const parts: (string | null)[] = [
    `Company: ${context.companyName}`,
    context.website ? `Website: ${context.website}` : null,
    context.industry ? `Industry: ${context.industry}` : null,
    "Page content:",
    crawlContent,
  ];

  if (playbook) {
    parts.push(
      [
        "Industry playbook context:",
        `- Common pains in this industry: ${playbook.commonPains.join(", ")}`,
        `- Offer angles: ${playbook.offerAngles.join(", ")}`,
        `- Messaging focus: ${playbook.messagingFocus}`,
      ].join("\n"),
    );
  }

  if (reviewSignals && reviewSignals.reviewCount > 0) {
    const reviewParts = [
      "Google review signals (use as additional pain evidence):",
      `- ${reviewSignals.summary}`,
    ];
    if (reviewSignals.complaintThemes.length > 0) {
      reviewParts.push(`- Complaint themes: ${reviewSignals.complaintThemes.join(", ")}`);
    }
    if (reviewSignals.negativeExcerpts.length > 0) {
      reviewParts.push("- Negative review excerpts:");
      for (const excerpt of reviewSignals.negativeExcerpts.slice(0, 3)) {
        reviewParts.push(`  > "${excerpt}"`);
      }
    }
    parts.push(reviewParts.join("\n"));
  }

  return parts.filter(Boolean).join("\n\n");
}

function buildFallbackResult(companyName: string): BusinessContextAndPain {
  return {
    business_context: buildFallbackBusinessContext(),
    pain_hypothesis: buildInsufficientEvidencePainHypothesis(companyName),
  };
}

export async function extractBusinessContextAndPain(
  context: CombinedContextInput,
  options?: CombinedContextOptions,
): Promise<BusinessContextAndPain> {
  const crawlContent = buildCrawlContent(context.crawlPages);

  if (!crawlContent.trim()) {
    return buildFallbackResult(context.companyName);
  }

  const userContent = buildUserContent(
    context,
    crawlContent,
    options?.playbook ?? null,
    options?.reviewSignals,
  );

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_BUSINESS_CONTEXT",
    systemPrompt: COMBINED_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "business_context_and_pain",
    jsonSchema: businessContextAndPainJsonSchema,
    zodSchema: businessContextAndPainSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}
