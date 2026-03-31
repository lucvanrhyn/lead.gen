import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const replyDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone_note: z.string(),
});

const REPLY_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body", "tone_note"],
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
    tone_note: { type: "string" },
  },
} as const;

const REPLY_DRAFT_SYSTEM_PROMPT = `You are a B2B sales reply writer. Given a prospect's reply classification, the original outreach thread, and context about the company, draft an appropriate response.

Rules:
- NEVER auto-agree to things you cannot deliver
- NEVER make promises not supported by the evidence
- Keep replies short (50-100 words)
- Match the prospect's tone and formality level
- For INTERESTED: Propose a concrete next step (send the lead magnet, schedule a brief call, share a relevant case study)
- For QUESTION_ASKED: Answer directly using available evidence, then guide toward next step
- For REFERRAL: Thank them, ask for a warm introduction if appropriate
- For MAYBE_LATER: Acknowledge timing, offer to follow up at a specific future date
- For OUT_OF_OFFICE: Note the return date if mentioned, plan to follow up after
- Do NOT draft replies for NOT_INTERESTED, UNSUBSCRIBE, BOUNCED, or BOOKED — return empty strings

subject: Re: [original subject] or appropriate reply subject
body: The reply text
tone_note: Brief note about why you chose this tone/approach`;

const NO_REPLY_CLASSIFICATIONS = new Set([
  "NOT_INTERESTED",
  "UNSUBSCRIBE",
  "BOUNCED",
]);

const EMPTY_DRAFT_RESULT = Object.freeze({
  subject: "",
  body: "",
  tone_note: "",
});

export async function generateReplyDraft(
  input: {
    classification: string;
    threadMessages: Array<{
      direction: "INBOUND" | "OUTBOUND";
      from: string;
      body: string;
    }>;
    companyName: string;
    originalSubject: string;
    painHypothesis?: {
      primary_pain: string;
      recommended_service_angle: string;
    } | null;
    leadMagnetTitle?: string | null;
  },
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
): Promise<z.infer<typeof replyDraftSchema>> {
  if (NO_REPLY_CLASSIFICATIONS.has(input.classification)) {
    return { ...EMPTY_DRAFT_RESULT };
  }

  const threadText = input.threadMessages
    .map((msg, index) => {
      return [
        `--- Message ${index + 1} [${msg.direction}] ---`,
        `From: ${msg.from}`,
        `Body:\n${msg.body}`,
      ].join("\n");
    })
    .join("\n\n");

  const sections: string[] = [
    `Company: ${input.companyName}`,
    `Original Subject: ${input.originalSubject}`,
    `Classification: ${input.classification}`,
  ];

  if (input.painHypothesis) {
    sections.push(
      [
        "Pain Hypothesis:",
        `  primary_pain: ${input.painHypothesis.primary_pain}`,
        `  recommended_service_angle: ${input.painHypothesis.recommended_service_angle}`,
      ].join("\n"),
    );
  }

  if (input.leadMagnetTitle) {
    sections.push(`Lead Magnet Title: ${input.leadMagnetTitle}`);
  }

  sections.push("", "Thread:", threadText);

  const userContent = sections.join("\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_REPLY",
    systemPrompt: REPLY_DRAFT_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "reply_draft",
    jsonSchema: REPLY_DRAFT_JSON_SCHEMA,
    zodSchema: replyDraftSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}
