import { EnrichmentStage, JobStatus, Prisma, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const qaCheckSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      field: z.string(),
      issue_type: z.enum([
        "hallucination",
        "fake_personalization",
        "spammy_language",
        "broken_merge_field",
        "weak_cta",
        "unsupported_claim",
        "too_long",
      ]),
      description: z.string(),
      severity: z.enum(["blocker", "warning"]),
      suggested_fix: z.string(),
    }),
  ),
  revised_fields: z.record(z.string(), z.string()),
});

const QA_CHECK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["passed", "issues", "revised_fields"],
  properties: {
    passed: { type: "boolean" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "issue_type", "description", "severity", "suggested_fix"],
        properties: {
          field: { type: "string" },
          issue_type: {
            type: "string",
            enum: [
              "hallucination",
              "fake_personalization",
              "spammy_language",
              "broken_merge_field",
              "weak_cta",
              "unsupported_claim",
              "too_long",
            ],
          },
          description: { type: "string" },
          severity: { type: "string", enum: ["blocker", "warning"] },
          suggested_fix: { type: "string" },
        },
      },
    },
    revised_fields: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  },
} as const;

const QA_SYSTEM_PROMPT = `You are a B2B outreach message quality assurance specialist. Given a draft outreach message and the evidence it was based on, validate the message quality.

Check for these issues:
- hallucination: Claims about the company that are not supported by the provided evidence. Any "fact" that cannot be traced back to the pain hypothesis, business context, or company information is a hallucination.
- fake_personalization: Generic flattery disguised as personalization. Phrases like "I love your website" or "Great work on your growth" without citing specifics.
- spammy_language: Phrases that trigger spam filters or feel salesy: "game-changer", "unlock", "skyrocket", "revolutionary", "Act now", "Limited time", excessive exclamation marks, ALL CAPS words.
- broken_merge_field: Unresolved template variables like {{name}}, {company}, or placeholder text like "[INSERT]" or "COMPANY_NAME".
- weak_cta: Call-to-action that is either too aggressive (demanding a call) or too vague (no clear next step). Good CTAs are low-friction: "Happy to send it over if useful."
- unsupported_claim: Stating something as definitive fact when the evidence only supports it as an inference or speculation. Check the caution_do_not_claim list.
- too_long: Primary email over 200 words, or short variant over 100 words.

For each issue found:
- Identify the field using these exact keys: "email_subject_1", "email_subject_2", "cold_email_short", "cold_email_medium", "linkedin_message_safe", "follow_up_1", "follow_up_2"
- Classify the severity: "blocker" (must fix before sending) or "warning" (review recommended)
- Provide a suggested_fix (the corrected text, or empty string if no fix is obvious)

If all fields pass, set passed=true with an empty issues array.
If you can fix blocker issues, provide the corrected text in revised_fields (key = one of the exact field names above, value = corrected text).

Be strict but fair. Real-world cold email is short and direct — don't flag conciseness as an issue.`;

type QaCheckInput = {
  outreachDraft: {
    emailSubject1: string;
    emailSubject2: string;
    coldEmailShort: string;
    coldEmailMedium: string;
    linkedinMessageSafe: string;
    followUp1: string;
    followUp2: string;
  };
  companyName: string;
  contactName?: string | null;
  painHypothesis: {
    primary_pain: string;
    company_summary?: string;
    confidence_score: number;
    caution_do_not_claim?: string[];
  };
  businessContext?: {
    website_summary: string;
    services_offerings: string[];
  } | null;
};

type QaCheckOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
};

export async function runQaCheck(
  input: QaCheckInput,
  options?: QaCheckOptions,
): Promise<z.infer<typeof qaCheckSchema>> {
  const { outreachDraft, companyName, contactName, painHypothesis, businessContext } = input;

  const sections: string[] = [
    `Company: ${companyName}`,
  ];

  if (contactName) {
    sections.push(`Contact Name: ${contactName}`);
  }

  sections.push(
    [
      "Outreach Draft:",
      `  email_subject_1: ${outreachDraft.emailSubject1}`,
      `  email_subject_2: ${outreachDraft.emailSubject2}`,
      `  cold_email_short: ${outreachDraft.coldEmailShort}`,
      `  cold_email_medium: ${outreachDraft.coldEmailMedium}`,
      `  linkedin_message_safe: ${outreachDraft.linkedinMessageSafe}`,
      `  follow_up_1: ${outreachDraft.followUp1}`,
      `  follow_up_2: ${outreachDraft.followUp2}`,
    ].join("\n"),
  );

  sections.push(
    [
      "Pain Hypothesis:",
      `  primary_pain: ${painHypothesis.primary_pain}`,
      painHypothesis.company_summary
        ? `  company_summary: ${painHypothesis.company_summary}`
        : null,
      `  confidence_score: ${painHypothesis.confidence_score}`,
      painHypothesis.caution_do_not_claim?.length
        ? `  caution_do_not_claim: ${painHypothesis.caution_do_not_claim.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (businessContext) {
    sections.push(
      [
        "Business Context:",
        `  website_summary: ${businessContext.website_summary}`,
        `  services_offerings: ${businessContext.services_offerings.join(", ")}`,
      ].join("\n"),
    );
  }

  const userContent = sections.join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_QA",
    modelTier: "light",
    systemPrompt: QA_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "qa_check",
    jsonSchema: QA_CHECK_JSON_SCHEMA,
    zodSchema: qaCheckSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export async function persistQaCheckResult(
  outreachDraftId: string,
  result: z.infer<typeof qaCheckSchema>,
): Promise<void> {
  const { db } = await import("@/lib/db");

  await db.qaCheckResult.create({
    data: {
      outreachDraftId,
      passed: result.passed,
      issues: result.issues,
      revisedFields: Object.keys(result.revised_fields).length > 0 ? result.revised_fields : Prisma.JsonNull,
      modelProvider: SourceProvider.OPENAI,
      rawPayload: result,
    },
  });

  await db.enrichmentJob.create({
    data: {
      provider: SourceProvider.OPENAI,
      stage: EnrichmentStage.OUTREACH_QA,
      status: result.passed ? JobStatus.SUCCEEDED : JobStatus.PARTIAL,
      attempts: 1,
      requestedBy: "qa-check",
      resultSummary: {
        passed: result.passed,
        issue_count: result.issues.length,
        blocker_count: result.issues.filter((i) => i.severity === "blocker").length,
      },
    },
  });
}
