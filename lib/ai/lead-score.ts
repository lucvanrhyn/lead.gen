import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";
import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const leadScoreSchema = z.object({
  total_score: z.number(),
  components: z.object({
    icp_fit: z.number(),
    data_completeness: z.number(),
    contactability: z.number(),
    decision_maker_certainty: z.number(),
    pain_evidence_strength: z.number(),
    urgency_signals: z.number(),
    serviceability: z.number(),
    outreach_confidence: z.number(),
  }),
  explanation: z.string(),
});

export const llmLeadScoreSchema = z.object({
  total_score: z.number(),
  sub_scores: z.object({
    icp_fit: z.object({ score: z.number(), rationale: z.string() }),
    pain_likelihood: z.object({ score: z.number(), rationale: z.string() }),
    reachability: z.object({ score: z.number(), rationale: z.string() }),
    personalization_surface_area: z.object({ score: z.number(), rationale: z.string() }),
    commercial_potential: z.object({ score: z.number(), rationale: z.string() }),
    urgency_trigger_signals: z.object({ score: z.number(), rationale: z.string() }),
  }),
  confidence: z.number(),
  rationale: z.string(),
  recommended_action: z.enum(["pursue", "nurture", "park", "disqualify"]),
  recommended_channel: z.enum(["email", "linkedin", "both", "phone"]),
  recommended_primary_contact_index: z.number(),
});

const llmLeadScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "total_score",
    "sub_scores",
    "confidence",
    "rationale",
    "recommended_action",
    "recommended_channel",
    "recommended_primary_contact_index",
  ],
  properties: {
    total_score: { type: "number" },
    sub_scores: {
      type: "object",
      additionalProperties: false,
      required: [
        "icp_fit",
        "pain_likelihood",
        "reachability",
        "personalization_surface_area",
        "commercial_potential",
        "urgency_trigger_signals",
      ],
      properties: {
        icp_fit: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
        pain_likelihood: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
        reachability: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
        personalization_surface_area: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
        commercial_potential: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
        urgency_trigger_signals: {
          type: "object",
          additionalProperties: false,
          required: ["score", "rationale"],
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
          },
        },
      },
    },
    confidence: { type: "number" },
    rationale: { type: "string" },
    recommended_action: { type: "string", enum: ["pursue", "nurture", "park", "disqualify"] },
    recommended_channel: { type: "string", enum: ["email", "linkedin", "both", "phone"] },
    recommended_primary_contact_index: { type: "number" },
  },
};

const LEAD_SCORE_SYSTEM_PROMPT = `You are a B2B lead scoring specialist. Given company information, contacts, pain hypothesis, and business context, score the lead across 6 dimensions.

Each sub-score is 0-100:
- icp_fit: How well does this company match the ideal customer profile for a B2B service business? Consider industry, size (5-250 employees ideal), service-based nature, and growth indicators.
- pain_likelihood: How likely is it that this company is actively experiencing the identified pain? Consider evidence strength, pain urgency, and business impact.
- reachability: How easy will it be to reach a decision-maker? Consider email availability, phone availability, and contact seniority/role clarity.
- personalization_surface_area: How much company-specific context is available for personalizing outreach? Consider website content richness, services clarity, team visibility, and unique differentiators.
- commercial_potential: How likely is this company to become a paying client? Consider company size, service complexity, budget indicators, and growth signals.
- urgency_trigger_signals: Are there signals suggesting the company needs to act soon? Consider hiring signals, expansion, compliance deadlines, seasonal factors, or competitive pressure.

total_score: Weighted average — pain_likelihood (25%), reachability (20%), commercial_potential (20%), icp_fit (15%), urgency_trigger_signals (10%), personalization_surface_area (10%).

confidence: 0-1, how confident you are in this overall assessment.

recommended_action:
- "pursue": Score >= 65, good evidence, reachable contacts
- "nurture": Score 40-64, some potential but needs more evidence or timing
- "park": Score 20-39, unlikely to convert now
- "disqualify": Score < 20, not a fit

recommended_channel: Based on contact availability and industry norms.

recommended_primary_contact_index: Index (0-based) into the contacts array for the best person to reach out to. Consider seniority, decision-maker confidence, and email availability.

Be calibrated. Do not inflate scores. A company with thin evidence and no clear pain should score low.`;

type LeadScoreContext = {
  hasIndustry: boolean;
  employeeCount?: number | null;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasLocation: boolean;
  contacts: Array<{
    hasEmail: boolean;
    hasPhone: boolean;
    decisionMakerConfidence?: number | null;
  }>;
  painConfidence?: number | null;
  painEvidenceCount: number;
  insufficientEvidence: boolean;
  formResponse?: {
    status?: "NOT_SHARED" | "LINK_ATTACHED" | "RESPONDED" | "REVIEWED";
    urgencyLevel?: "LOW" | "MEDIUM" | "HIGH";
    budgetReadiness?: "NOT_READY" | "EXPLORING" | "READY";
    workflowDetailDepth?: "LIGHT" | "DETAILED";
  };
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** @deprecated Use scoreLeadContextDeterministic or generateLeadScore */
export const scoreLeadContext = scoreLeadContextDeterministic;

export function scoreLeadContextDeterministic(context: LeadScoreContext) {
  const formUrgencyBoost =
    context.formResponse?.urgencyLevel === "HIGH"
      ? 18
      : context.formResponse?.urgencyLevel === "MEDIUM"
        ? 10
        : 0;
  const formReadinessBoost =
    context.formResponse?.budgetReadiness === "READY"
      ? 15
      : context.formResponse?.budgetReadiness === "EXPLORING"
        ? 8
        : 0;
  const workflowDetailBoost = context.formResponse?.workflowDetailDepth === "DETAILED" ? 10 : 0;

  const icpFit = clampScore(
    45 +
      (context.hasIndustry ? 20 : 0) +
      (context.employeeCount && context.employeeCount >= 5 && context.employeeCount <= 250
        ? 20
        : 5),
  );

  const dataCompleteness = clampScore(
    [context.hasWebsite, context.hasPhone, context.hasIndustry, context.hasLocation]
      .filter(Boolean)
      .length * 22,
  );

  const contactability = clampScore(
    context.contacts.reduce((score, contact) => {
      let total = score;
      if (contact.hasEmail) total += 40;
      if (contact.hasPhone) total += 25;
      return total;
    }, 20),
  );

  const averageDecisionMakerConfidence =
    context.contacts.length > 0
      ? context.contacts.reduce(
          (sum, contact) => sum + (contact.decisionMakerConfidence ?? 0.3),
          0,
        ) / context.contacts.length
      : 0.25;

  const decisionMakerCertainty = clampScore(averageDecisionMakerConfidence * 100);

  const painEvidenceStrength = context.insufficientEvidence
    ? 18
    : clampScore((context.painConfidence ?? 0.4) * 100 + context.painEvidenceCount * 6);

  const urgencySignals = clampScore(
    28 +
      (context.painEvidenceCount > 1 ? 28 : 8) +
      formUrgencyBoost,
  );

  const serviceability = clampScore(
    42 +
      (context.hasWebsite ? 20 : 0) +
      (context.hasIndustry ? 18 : 0) +
      workflowDetailBoost,
  );

  const outreachConfidence = clampScore(
    (contactability * 0.35) +
      (painEvidenceStrength * 0.3) +
      (decisionMakerCertainty * 0.25) +
      formReadinessBoost +
      Math.round(workflowDetailBoost * 0.6),
  );

  const components = {
    icp_fit: icpFit,
    data_completeness: dataCompleteness,
    contactability,
    decision_maker_certainty: decisionMakerCertainty,
    pain_evidence_strength: painEvidenceStrength,
    urgency_signals: urgencySignals,
    serviceability,
    outreach_confidence: outreachConfidence,
  };

  const totalScore = clampScore(
    Object.values(components).reduce((sum, value) => sum + value, 0) /
      Object.values(components).length,
  );

  return leadScoreSchema.parse({
    total_score: totalScore,
    components,
    explanation:
      context.insufficientEvidence
        ? "Lead is partially scored with conservative pain evidence because the public footprint is still thin."
        : "Lead score combines ICP fit, data completeness, contactability, decision-maker certainty, pain evidence, urgency, serviceability, and outreach confidence.",
  });
}

type GenerateLeadScoreInput = {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  description?: string | null;
  contacts: Array<{
    fullName: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    seniority: string | null;
    decisionMakerConfidence: number | null;
  }>;
  painHypothesis: {
    primary_pain: string;
    confidence_score: number;
    business_impact: string;
    company_summary?: string;
    observed_signals?: Array<{ signal: string; confidence: number }>;
    best_outreach_angle?: string;
    insufficient_evidence: boolean;
  };
  businessContext?: {
    website_summary: string;
    services_offerings: string[];
    customer_type: string;
    urgency_signals: string[];
    weak_lead_capture_signals: string[];
  } | null;
  playbook?: {
    commonPains: string[];
    messagingFocus: string;
  } | null;
};

function buildLeadScoreUserContent(input: GenerateLeadScoreInput): string {
  const lines: string[] = [];

  lines.push("## Company Info");
  lines.push(`Name: ${input.companyName}`);
  if (input.website) lines.push(`Website: ${input.website}`);
  if (input.industry) lines.push(`Industry: ${input.industry}`);
  if (input.employeeCount != null) lines.push(`Employee Count: ${input.employeeCount}`);
  if (input.description) lines.push(`Description: ${input.description}`);

  lines.push("");
  lines.push("## Contacts");
  if (input.contacts.length === 0) {
    lines.push("No contacts available.");
  } else {
    input.contacts.forEach((contact, index) => {
      const parts = [
        `${index + 1}.`,
        contact.fullName ?? "Unknown",
        contact.title ? `(${contact.title})` : null,
        contact.seniority ? `[${contact.seniority}]` : null,
        contact.email ? `email: ${contact.email}` : "no email",
        contact.phone ? `phone: ${contact.phone}` : "no phone",
        contact.decisionMakerConfidence != null
          ? `decision-maker confidence: ${(contact.decisionMakerConfidence * 100).toFixed(0)}%`
          : null,
      ].filter(Boolean);
      lines.push(parts.join(" "));
    });
  }

  lines.push("");
  lines.push("## Pain Hypothesis");
  lines.push(`Primary Pain: ${input.painHypothesis.primary_pain}`);
  lines.push(`Confidence: ${(input.painHypothesis.confidence_score * 100).toFixed(0)}%`);
  lines.push(`Business Impact: ${input.painHypothesis.business_impact}`);
  lines.push(`Insufficient Evidence: ${input.painHypothesis.insufficient_evidence ? "yes" : "no"}`);
  if (input.painHypothesis.company_summary) {
    lines.push(`Company Summary: ${input.painHypothesis.company_summary}`);
  }
  if (input.painHypothesis.best_outreach_angle) {
    lines.push(`Best Outreach Angle: ${input.painHypothesis.best_outreach_angle}`);
  }
  if (input.painHypothesis.observed_signals && input.painHypothesis.observed_signals.length > 0) {
    lines.push("Observed Signals:");
    for (const sig of input.painHypothesis.observed_signals) {
      lines.push(`  - ${sig.signal} (confidence: ${(sig.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (input.businessContext) {
    lines.push("");
    lines.push("## Business Context");
    lines.push(`Website Summary: ${input.businessContext.website_summary}`);
    lines.push(`Customer Type: ${input.businessContext.customer_type}`);
    if (input.businessContext.services_offerings.length > 0) {
      lines.push(`Services: ${input.businessContext.services_offerings.join(", ")}`);
    }
    if (input.businessContext.urgency_signals.length > 0) {
      lines.push(`Urgency Signals: ${input.businessContext.urgency_signals.join(", ")}`);
    }
    if (input.businessContext.weak_lead_capture_signals.length > 0) {
      lines.push(
        `Weak Lead Capture Signals: ${input.businessContext.weak_lead_capture_signals.join(", ")}`,
      );
    }
  }

  if (input.playbook) {
    lines.push("");
    lines.push("## Industry Playbook");
    lines.push(`Messaging Focus: ${input.playbook.messagingFocus}`);
    if (input.playbook.commonPains.length > 0) {
      lines.push(`Common Pains: ${input.playbook.commonPains.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export async function generateLeadScore(
  input: GenerateLeadScoreInput,
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
): Promise<z.infer<typeof llmLeadScoreSchema>> {
  const userContent = buildLeadScoreUserContent(input);

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_LEAD_SCORE",
    systemPrompt: LEAD_SCORE_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "lead_score",
    jsonSchema: llmLeadScoreJsonSchema,
    zodSchema: llmLeadScoreSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export async function persistLeadScore(
  companyId: string,
  score: z.infer<typeof leadScoreSchema> | z.infer<typeof llmLeadScoreSchema>,
  recommendedContactId?: string,
) {
  const { db } = await import("@/lib/db");

  const isLlmScore = "sub_scores" in score;

  const data = isLlmScore
    ? {
        companyId,
        totalScore: score.total_score,
        componentScores: score.sub_scores,
        explanation: score.rationale,
        confidence: score.confidence,
        rationale: score.rationale,
        recommendedAction: score.recommended_action,
        recommendedChannel: score.recommended_channel,
        recommendedContactId: recommendedContactId ?? null,
        modelProvider: SourceProvider.OPENAI,
        rawPayload: score,
      }
    : {
        companyId,
        totalScore: score.total_score,
        componentScores: score.components,
        explanation: score.explanation,
        confidence: null,
        rationale: null,
        recommendedAction: null,
        recommendedChannel: null,
        recommendedContactId: null,
        modelProvider: SourceProvider.SYSTEM,
        rawPayload: score,
      };

  await db.leadScore.create({ data });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: data.modelProvider,
      stage: EnrichmentStage.LEAD_SCORING,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.score",
      resultSummary: {
        total_score: score.total_score,
      },
    },
  });
}
