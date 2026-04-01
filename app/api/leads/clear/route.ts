import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/middleware/rate-limit";

const CLEAR_RATE_LIMIT = 1;
const CLEAR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, resetAt } = checkRateLimit(
    `leads-clear:${ip}`,
    CLEAR_RATE_LIMIT,
    CLEAR_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // Delete in dependency order to avoid FK violations.
  // Prisma cascades handle most relations, but explicit ordering is safer.
  await db.$transaction(async (tx) => {
    await tx.replyAnalysis.deleteMany({});
    await tx.qaCheckResult.deleteMany({});
    await tx.outreachEngagementEvent.deleteMany({});
    await tx.gmailDraftLink.deleteMany({});
    await tx.sheetSyncRecord.deleteMany({});
    await tx.outreachDraft.deleteMany({});
    await tx.leadMagnetAsset.deleteMany({});
    await tx.diagnosticFormLink.deleteMany({});
    await tx.diagnosticFormBlueprint.deleteMany({});
    await tx.leadMagnet.deleteMany({});
    await tx.leadScore.deleteMany({});
    await tx.businessContext.deleteMany({});
    await tx.painHypothesis.deleteMany({});
    await tx.technologyProfile.deleteMany({});
    await tx.newsMention.deleteMany({});
    await tx.companyLocation.deleteMany({});
    await tx.crawlPage.deleteMany({});
    await tx.enrichmentJob.deleteMany({});
    await tx.sourceEvent.deleteMany({});
    await tx.linkedInTask.deleteMany({});
    await tx.contact.deleteMany({});
    await tx.batchLead.deleteMany({});
    await tx.leadBatch.deleteMany({});
    await tx.company.deleteMany({});
  });

  return NextResponse.json({ ok: true });
}
