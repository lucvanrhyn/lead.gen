import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

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
  hasTechnologyProfile: boolean;
  newsMentionsCount: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreLeadContext(context: LeadScoreContext) {
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
    28 + Math.min(28, context.newsMentionsCount * 18) + (context.painEvidenceCount > 1 ? 18 : 8),
  );

  const serviceability = clampScore(
    42 +
      (context.hasWebsite ? 15 : 0) +
      (context.hasTechnologyProfile ? 18 : 5) +
      (context.hasIndustry ? 15 : 0),
  );

  const outreachConfidence = clampScore(
    (contactability * 0.35) +
      (painEvidenceStrength * 0.35) +
      (decisionMakerCertainty * 0.3),
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

export async function persistLeadScore(
  companyId: string,
  score: z.infer<typeof leadScoreSchema>,
) {
  const { db } = await import("@/lib/db");

  await db.leadScore.create({
    data: {
      companyId,
      totalScore: score.total_score,
      componentScores: score.components,
      explanation: score.explanation,
      modelProvider: SourceProvider.SYSTEM,
      rawPayload: score,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.SYSTEM,
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
