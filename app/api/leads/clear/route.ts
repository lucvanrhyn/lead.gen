import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  // Delete in dependency order to avoid FK violations.
  // Prisma cascades handle most relations, but explicit ordering is safer.
  await db.replyAnalysis.deleteMany({});
  await db.qaCheckResult.deleteMany({});
  await db.outreachEngagementEvent.deleteMany({});
  await db.gmailDraftLink.deleteMany({});
  await db.sheetSyncRecord.deleteMany({});
  await db.outreachDraft.deleteMany({});
  await db.leadMagnetAsset.deleteMany({});
  await db.diagnosticFormLink.deleteMany({});
  await db.diagnosticFormBlueprint.deleteMany({});
  await db.leadMagnet.deleteMany({});
  await db.leadScore.deleteMany({});
  await db.businessContext.deleteMany({});
  await db.painHypothesis.deleteMany({});
  await db.technologyProfile.deleteMany({});
  await db.newsMention.deleteMany({});
  await db.companyLocation.deleteMany({});
  await db.crawlPage.deleteMany({});
  await db.enrichmentJob.deleteMany({});
  await db.sourceEvent.deleteMany({});
  await db.linkedInTask.deleteMany({});
  await db.contact.deleteMany({});
  await db.batchLead.deleteMany({});
  await db.leadBatch.deleteMany({});
  await db.company.deleteMany({});

  return NextResponse.json({ ok: true });
}
