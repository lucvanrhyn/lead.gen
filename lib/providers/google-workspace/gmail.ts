import { google } from "googleapis";

type GmailDraftInput = {
  to: string;
  subject: string;
  body: string;
};

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
