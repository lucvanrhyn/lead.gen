import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { generateFollowUpContent } from "@/lib/ai/follow-up-sequence";
import { db } from "@/lib/db";
import {
  checkFollowUpStopConditions,
  getFollowUpsDueForProcessing,
} from "@/lib/domain/follow-up-scheduler";

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueDrafts = await getFollowUpsDueForProcessing(db);
  const results = { processed: 0, stopped: 0, errors: 0 };

  for (const draft of dueDrafts) {
    const parent = draft.parentDraft;

    if (!parent) {
      await db.outreachDraft.update({
        where: { id: draft.id },
        data: { sequenceStatus: "stopped" },
      });
      results.stopped += 1;
      continue;
    }

    const stopCheck = await checkFollowUpStopConditions(draft.companyId, parent.id, db);

    if (stopCheck.shouldStop) {
      await db.outreachDraft.updateMany({
        where: { parentDraftId: parent.id, sequenceStatus: "active" },
        data: { sequenceStatus: "stopped" },
      });
      results.stopped += 1;
      continue;
    }

    try {
      const painHypothesis = parent.company.painHypotheses[0];
      const leadMagnet = parent.company.leadMagnets[0];

      const angle = (["bump", "value_add", "soft_close"] as const)[draft.sequenceStep - 2] ?? "bump";

      const content = await generateFollowUpContent({
        sequenceStep: draft.sequenceStep,
        companyName: parent.company.name,
        contactName: parent.contact?.firstName ?? parent.contact?.fullName ?? null,
        originalSubject: parent.emailSubject1,
        originalEmailBody: parent.coldEmailMedium,
        painHypothesis: {
          primary_pain: painHypothesis?.primaryPain ?? "business growth challenges",
          recommended_service_angle:
            painHypothesis?.recommendedServiceAngle ?? "efficiency improvement",
        },
        leadMagnetTitle: leadMagnet?.title ?? "resource",
        angle,
      });

      await db.outreachDraft.update({
        where: { id: draft.id },
        data: {
          emailSubject1: content.subject,
          emailSubject2: content.subject,
          coldEmailShort: content.email_body,
          coldEmailMedium: content.email_body,
          linkedinMessageSafe: content.linkedin_message,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        },
      });

      results.processed += 1;
    } catch {
      results.errors += 1;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
