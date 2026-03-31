import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const followUpContentSchema = z.object({
  subject: z.string(),
  email_body: z.string(),
  linkedin_message: z.string(),
  angle: z.enum(["bump", "value_add", "question", "soft_close"]),
  rationale: z.string(),
});

export type FollowUpContent = z.infer<typeof followUpContentSchema>;

const FOLLOW_UP_JSON_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    email_body: { type: "string" },
    linkedin_message: { type: "string" },
    angle: { type: "string", enum: ["bump", "value_add", "question", "soft_close"] },
    rationale: { type: "string" },
  },
  required: ["subject", "email_body", "linkedin_message", "angle", "rationale"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a B2B follow-up email specialist. Generate a follow-up message for a prospect who hasn't replied to the initial outreach.

Follow-up angles:
- bump: Short, same thread. Gently reference the original offer. 30-50 words.
- value_add: Different angle from the initial email. Share a relevant insight, statistic, or reference the lead magnet differently. 50-80 words.
- question: Ask a specific, relevant question that prompts a reply. Not generic. 30-50 words.
- soft_close: Acknowledge the silence gracefully. Leave the door open. Final touch. 30-50 words.

Rules:
- NEVER repeat the exact same messaging from prior emails
- NEVER be passive-aggressive about not getting a reply
- NEVER use "just following up" or "circling back" without adding value
- Keep it shorter than the original email
- The subject should work as a reply to the original thread (can be brief)
- LinkedIn message should be even shorter and more conversational`;

type GenerateFollowUpInput = {
  sequenceStep: number;
  companyName: string;
  contactName?: string | null;
  originalSubject: string;
  originalEmailBody: string;
  painHypothesis: {
    primary_pain: string;
    recommended_service_angle: string;
  };
  leadMagnetTitle: string;
  angle: "bump" | "value_add" | "question" | "soft_close";
};

type GenerateFollowUpOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
};

export async function generateFollowUpContent(
  input: GenerateFollowUpInput,
  options?: GenerateFollowUpOptions,
): Promise<FollowUpContent> {
  const userContent = [
    `Company: ${input.companyName}`,
    input.contactName ? `Contact: ${input.contactName}` : null,
    `Sequence step: ${input.sequenceStep}`,
    `Angle to use: ${input.angle}`,
    `Original subject: ${input.originalSubject}`,
    `Original email body:\n${input.originalEmailBody}`,
    `Pain hypothesis: ${input.painHypothesis.primary_pain}`,
    `Service angle: ${input.painHypothesis.recommended_service_angle}`,
    `Lead magnet: ${input.leadMagnetTitle}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_OUTREACH",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "follow_up_content",
    jsonSchema: FOLLOW_UP_JSON_SCHEMA,
    zodSchema: followUpContentSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}
