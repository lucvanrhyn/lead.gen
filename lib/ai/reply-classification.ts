import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";
import { z } from "zod";

import { callOpenAiResponsesApi } from "@/lib/ai/openai-client";

export const replyClassificationSchema = z.object({
  classification: z.enum([
    "INTERESTED",
    "MAYBE_LATER",
    "NOT_INTERESTED",
    "REFERRAL",
    "QUESTION_ASKED",
    "OUT_OF_OFFICE",
    "UNSUBSCRIBE",
    "BOUNCED",
    "BOOKED",
  ]),
  confidence: z.number(),
  summary: z.string(),
  suggested_action: z.string(),
  should_stop_follow_ups: z.boolean(),
});

const REPLY_CLASSIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "classification",
    "confidence",
    "summary",
    "suggested_action",
    "should_stop_follow_ups",
  ],
  properties: {
    classification: {
      type: "string",
      enum: [
        "INTERESTED",
        "MAYBE_LATER",
        "NOT_INTERESTED",
        "REFERRAL",
        "QUESTION_ASKED",
        "OUT_OF_OFFICE",
        "UNSUBSCRIBE",
        "BOUNCED",
        "BOOKED",
      ],
    },
    confidence: { type: "number" },
    summary: { type: "string" },
    suggested_action: { type: "string" },
    should_stop_follow_ups: { type: "boolean" },
  },
} as const;

const REPLY_CLASSIFICATION_SYSTEM_PROMPT = `You are a B2B sales reply classifier. Given an email thread between a salesperson and a prospect, classify the prospect's most recent reply.

Classifications:
- INTERESTED: Prospect expresses interest, asks for more info, or wants to proceed
- MAYBE_LATER: Timing isn't right but doesn't dismiss entirely ("circle back later", "not right now")
- NOT_INTERESTED: Clear rejection ("not interested", "please don't contact", "no thank you")
- REFERRAL: Prospect redirects to someone else ("you should talk to...", "I'm forwarding this to...")
- QUESTION_ASKED: Prospect asks a specific question about the offer, service, or deliverable
- OUT_OF_OFFICE: Auto-reply indicating the person is unavailable
- UNSUBSCRIBE: Explicit request to stop emails ("remove me", "unsubscribe", "stop emailing")
- BOUNCED: Delivery failure notification (address not found, mailbox full, domain error)
- BOOKED: Prospect agrees to a meeting, call, or next step ("let's set up a call", "I'm free Tuesday")

Rules:
- Focus on the prospect's MOST RECENT message only
- If ambiguous, choose the most conservative classification
- confidence: 0-1, how certain you are about this classification
- summary: 1 sentence describing what the prospect said/wants
- suggested_action: What the salesperson should do next (1 sentence)
- should_stop_follow_ups: true for NOT_INTERESTED, UNSUBSCRIBE, BOUNCED, BOOKED. false for INTERESTED, QUESTION_ASKED, REFERRAL. Contextual for MAYBE_LATER and OUT_OF_OFFICE.`;

export async function classifyReply(
  input: {
    threadMessages: Array<{
      direction: "INBOUND" | "OUTBOUND";
      from: string;
      subject?: string;
      body: string;
      sentAt?: string;
    }>;
    originalSubject: string;
    companyName: string;
  },
  options?: {
    apiKey?: string;
    fetchFn?: typeof fetch;
  },
): Promise<z.infer<typeof replyClassificationSchema>> {
  const threadText = input.threadMessages
    .map((msg, index) => {
      const parts = [
        `--- Message ${index + 1} [${msg.direction}] ---`,
        `From: ${msg.from}`,
      ];
      if (msg.sentAt) parts.push(`Sent: ${msg.sentAt}`);
      if (msg.subject) parts.push(`Subject: ${msg.subject}`);
      parts.push(`Body:\n${msg.body}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const userContent = [
    `Company: ${input.companyName}`,
    `Original Subject: ${input.originalSubject}`,
    "",
    "Thread:",
    threadText,
  ].join("\n");

  return callOpenAiResponsesApi({
    envModelKey: "OPENAI_MODEL_REPLY",
    systemPrompt: REPLY_CLASSIFICATION_SYSTEM_PROMPT,
    userContent,
    jsonSchemaName: "reply_classification",
    jsonSchema: REPLY_CLASSIFICATION_JSON_SCHEMA,
    zodSchema: replyClassificationSchema,
    apiKey: options?.apiKey,
    fetchFn: options?.fetchFn,
  });
}

export async function persistReplyAnalysis(input: {
  engagementEventId: string;
  outreachDraftId: string;
  classification: z.infer<typeof replyClassificationSchema>;
  replyDraft?: { subject: string; body: string } | null;
}) {
  const { db } = await import("@/lib/db");

  const analysis = await db.replyAnalysis.create({
    data: {
      engagementEventId: input.engagementEventId,
      outreachDraftId: input.outreachDraftId,
      classification: input.classification.classification,
      confidence: input.classification.confidence,
      summary: input.classification.summary,
      suggestedAction: input.classification.suggested_action,
      shouldStopFollowUps: input.classification.should_stop_follow_ups,
      replyDraftSubject: input.replyDraft?.subject ?? null,
      replyDraftBody: input.replyDraft?.body ?? null,
      modelProvider: SourceProvider.OPENAI,
      rawPayload: input.classification,
    },
  });

  await db.enrichmentJob.create({
    data: {
      provider: SourceProvider.OPENAI,
      stage: EnrichmentStage.REPLY_CLASSIFICATION,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "reply-classification",
      resultSummary: {
        classification: input.classification.classification,
        confidence: input.classification.confidence,
        engagementEventId: input.engagementEventId,
      },
    },
  });

  return analysis;
}
