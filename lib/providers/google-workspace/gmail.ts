import { google } from "googleapis";

type GmailDraftInput = {
  to: string;
  subject: string;
  body: string;
};

type GmailThreadInput = {
  auth: unknown;
  threadId: string;
};

type GmailThreadApiMessage = {
  id?: string | null;
  threadId?: string | null;
  internalDate?: string | null;
  labelIds?: string[] | null;
  snippet?: string | null;
  payload?: {
    headers?: Array<{
      name?: string | null;
      value?: string | null;
    }>;
  } | null;
};

export type GmailThreadMessageSnapshot = {
  id: string;
  threadId: string;
  internalDate: string | null;
  labelIds: string[];
  snippet: string | null;
  from: string | null;
  fromEmail: string | null;
  to: string | null;
  subject: string | null;
  messageId: string | null;
  inReplyTo: string[];
  references: string[];
  direction: "OUTBOUND" | "INBOUND";
  isReply: boolean;
};

export type GmailThreadSnapshot = {
  threadId: string;
  accountEmail: string | null;
  messageCount: number;
  sentAt: string | null;
  latestMessageAt: string | null;
  latestMessageDirection: "OUTBOUND" | "INBOUND" | null;
  hasReply: boolean;
  replyDetectedAt: string | null;
  replyMessageId: string | null;
  messages: GmailThreadMessageSnapshot[];
};

function getHeaderValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string,
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ??
    null
  );
}

function extractEmailAddress(value: string | null) {
  if (!value) {
    return null;
  }

  const bracketMatch = value.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }

  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return emailMatch?.[0]?.trim().toLowerCase() ?? null;
}

function normalizeMessageId(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^<(.+)>$/);
  return match?.[1] ?? trimmed;
}

function parseRelatedMessageIds(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((item) => normalizeMessageId(item.replace(/,$/, "")))
    .filter((item): item is string => Boolean(item));
}

function toIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeThreadMessage(
  message: GmailThreadApiMessage,
  accountEmail: string | null,
  outboundReferenceIds: Set<string>,
): GmailThreadMessageSnapshot {
  const headers = message.payload?.headers ?? [];
  const from = getHeaderValue(headers, "From");
  const fromEmail = extractEmailAddress(from);
  const to = getHeaderValue(headers, "To");
  const subject = getHeaderValue(headers, "Subject");
  const messageId = normalizeMessageId(getHeaderValue(headers, "Message-ID"));
  const inReplyTo = parseRelatedMessageIds(getHeaderValue(headers, "In-Reply-To"));
  const references = parseRelatedMessageIds(getHeaderValue(headers, "References"));
  const labelIds = message.labelIds ?? [];
  const direction =
    labelIds.includes("SENT") ||
    (accountEmail && fromEmail === accountEmail.toLowerCase())
      ? "OUTBOUND"
      : "INBOUND";
  const isReply =
    direction === "INBOUND" &&
    [...inReplyTo, ...references].some((reference) => outboundReferenceIds.has(reference));

  return {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    internalDate: toIsoDate(message.internalDate),
    labelIds,
    snippet: message.snippet ?? null,
    from,
    fromEmail,
    to,
    subject,
    messageId,
    inReplyTo,
    references,
    direction,
    isReply,
  };
}

export function appendOutreachDeliveryLinks(input: {
  body: string;
  assetUrl?: string | null;
  diagnosticFormUrl?: string | null;
}) {
  const sections = [input.body.trim()];

  if (input.assetUrl) {
    sections.push(`Lead magnet: ${input.assetUrl}`);
  }

  if (input.diagnosticFormUrl) {
    sections.push(`Diagnostic form: ${input.diagnosticFormUrl}`);
  }

  return sections.filter(Boolean).join("\n\n");
}

export function buildGmailDraftRawMessage({ to, subject, body }: GmailDraftInput) {
  const mime = [
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    `To: ${to}`,
    `Subject: ${subject}`,
    "",
    body,
  ].join("\r\n");

  return Buffer.from(mime, "utf8").toString("base64url");
}

export async function createGoogleWorkspaceGmailDraft(input: GmailDraftInput & { auth: unknown }) {
  const gmail = google.gmail({ version: "v1", auth: input.auth as never });
  const raw = buildGmailDraftRawMessage(input);
  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw },
    },
  });

  return {
    gmailDraftId: response.data.id ?? "",
    gmailMessageId: response.data.message?.id ?? null,
    gmailThreadId: response.data.message?.threadId ?? null,
  };
}

export async function fetchGoogleWorkspaceGmailThread(input: GmailThreadInput) {
  const gmail = google.gmail({ version: "v1", auth: input.auth as never });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const threadResponse = await gmail.users.threads.get({
    userId: "me",
    id: input.threadId,
    format: "full",
  });

  const accountEmail = profile.data.emailAddress?.toLowerCase() ?? null;
  const rawMessages = ((threadResponse.data.messages ?? []) as GmailThreadApiMessage[]).slice();

  const outboundReferenceIds = new Set<string>();
  for (const message of rawMessages) {
    const headers = message.payload?.headers ?? [];
    const labelIds = message.labelIds ?? [];
    const from = extractEmailAddress(getHeaderValue(headers, "From"));
    if (
      labelIds.includes("SENT") ||
      (accountEmail && from === accountEmail)
    ) {
      const messageId = normalizeMessageId(getHeaderValue(headers, "Message-ID"));
      if (messageId) {
        outboundReferenceIds.add(messageId);
      }
      if (message.id) {
        outboundReferenceIds.add(message.id);
      }
    }
  }

  const messages = rawMessages
    .map((message) => normalizeThreadMessage(message, accountEmail, outboundReferenceIds))
    .sort((left, right) => {
      const leftTime = left.internalDate ? new Date(left.internalDate).getTime() : 0;
      const rightTime = right.internalDate ? new Date(right.internalDate).getTime() : 0;
      return leftTime - rightTime;
    });

  const outboundMessages = messages.filter((message) => message.direction === "OUTBOUND");
  const inboundMessages = messages.filter((message) => message.direction === "INBOUND");
  const replyMessage =
    inboundMessages.find((message) => message.isReply) ??
    (outboundMessages.length > 0 && inboundMessages.length > 0
      ? inboundMessages[inboundMessages.length - 1]
      : null);
  const latestMessage = messages[messages.length - 1] ?? null;

  return {
    threadId: threadResponse.data.id ?? input.threadId,
    accountEmail,
    messageCount: messages.length,
    sentAt: outboundMessages[0]?.internalDate ?? null,
    latestMessageAt: latestMessage?.internalDate ?? null,
    latestMessageDirection: latestMessage?.direction ?? null,
    hasReply: Boolean(replyMessage),
    replyDetectedAt: replyMessage?.internalDate ?? null,
    replyMessageId: replyMessage?.id ?? null,
    messages,
  } satisfies GmailThreadSnapshot;
}
