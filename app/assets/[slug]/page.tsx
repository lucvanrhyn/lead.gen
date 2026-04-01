import { ApprovalStatus, EngagementEventType, OutreachDraftType } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildFollowUpDraft } from "@/lib/ai/outreach";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const asset = await db.leadMagnetAsset.findUnique({
    where: { slug },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      outreachDraft: {
        select: {
          id: true,
          companyId: true,
          contactId: true,
          sequenceStep: true,
          contact: {
            select: {
              firstName: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  const now = new Date();
  const firstView = asset.viewCount === 0;
  let followUpDraftId: string | undefined;

  await db.leadMagnetAsset.update({
    where: { id: asset.id },
    data: {
      viewCount: {
        increment: 1,
      },
      firstViewedAt: asset.firstViewedAt ?? now,
      lastViewedAt: now,
    },
  });

  let followUpCreated = false;

  if (firstView && !asset.followUpCreatedAt) {
    const claimed = await db.leadMagnetAsset.updateMany({
      where: {
        id: asset.id,
        followUpCreatedAt: null,
      },
      data: {
        followUpCreatedAt: now,
      },
    });

    if (claimed.count === 1) {
      const followUp = buildFollowUpDraft({
        companyName: asset.company.name,
        contactName: asset.outreachDraft.contact?.firstName ?? asset.outreachDraft.contact?.fullName ?? undefined,
        leadMagnetTitle: asset.headline,
        engagementType: "ASSET_VIEW",
      });

      // Find the max existing sequence step for this parent draft to avoid a
      // unique constraint violation — the pipeline may have already created
      // follow-up skeletons at steps 2, 3, and 4.
      const existingFollowUps = await db.outreachDraft.findMany({
        where: { parentDraftId: asset.outreachDraft.id },
        select: { sequenceStep: true },
      });
      const maxExistingStep = existingFollowUps.reduce(
        (max, d) => Math.max(max, d.sequenceStep),
        asset.outreachDraft.sequenceStep,
      );

      const followUpDraft = await db.outreachDraft.create({
        data: {
          companyId: asset.companyId,
          contactId: asset.outreachDraft.contactId,
          parentDraftId: asset.outreachDraft.id,
          draftType: OutreachDraftType.FOLLOW_UP,
          sequenceStep: maxExistingStep + 1,
          emailSubject1: followUp.email_subject_1,
          emailSubject2: followUp.email_subject_2,
          coldEmailShort: followUp.cold_email_short,
          coldEmailMedium: followUp.cold_email_medium,
          linkedinMessageSafe: followUp.linkedin_message_safe,
          followUp1: followUp.follow_up_1,
          followUp2: followUp.follow_up_2,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          rawPayload: followUp,
        },
      });
      followUpDraftId = followUpDraft.id;
      followUpCreated = true;
    }
  }

  await db.outreachEngagementEvent.create({
    data: {
      outreachDraftId: asset.outreachDraft.id,
      companyId: asset.companyId,
      contactId: asset.outreachDraft.contactId,
      eventType: EngagementEventType.ASSET_VIEW,
      followUpCreated,
      payload: {
        assetSlug: asset.slug,
        assetPath: `/assets/${asset.slug}`,
        assetTitle: asset.headline,
        ...(followUpDraftId ? { followUpDraftId } : {}),
      },
    },
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,105,20,0.14),_transparent_38%),linear-gradient(180deg,_#16110c_0%,_#0f0c09_100%)] px-6 py-10 text-[#f5ebd4] sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2.5rem] border border-[rgba(210,180,140,0.14)] bg-[rgba(26,21,16,0.94)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="font-serif text-xs uppercase tracking-[0.24em] text-[#d2b48c]">
            Hosted lead magnet
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-[#f5ebd4] sm:text-5xl">
            {asset.headline}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[rgba(245,235,212,0.85)]">
            {asset.intro}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-[rgba(245,235,212,0.72)]">
            <span className="rounded-full border border-[rgba(210,180,140,0.14)] px-4 py-2">
              {asset.status.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-[rgba(210,180,140,0.14)] px-4 py-2">
              Views {asset.viewCount + 1}
            </span>
            <span className="rounded-full border border-[rgba(210,180,140,0.14)] px-4 py-2">
              Company {asset.company.name}
            </span>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <article className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-7">
            <p className="font-serif text-xs uppercase tracking-[0.22em] text-[#d2b48c]">
              What this page is for
            </p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-[rgba(245,235,212,0.85)]">
              <p>
                This asset is the same link used in outreach, so every view rolls back to the
                original outreach draft instead of a separate tracking page.
              </p>
              <p>
                If this is relevant, the cleanest next step is to reply, request a tailored
                version, or continue with the short diagnostic attached to the outreach.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {asset.outreachDraft.contact?.email ? (
                <Link
                  className="rounded-full bg-[#f5ebd4] px-5 py-3 text-sm font-semibold text-[#120f0c]"
                  href={`mailto:${asset.outreachDraft.contact.email}?subject=${encodeURIComponent(asset.headline)}`}
                >
                  Request a tailored version
                </Link>
              ) : null}
              {asset.diagnosticFormUrl ? (
                <Link
                  className="rounded-full border border-[rgba(210,180,140,0.16)] px-5 py-3 text-sm text-[#f5ebd4]"
                  href={asset.diagnosticFormUrl}
                >
                  Open the diagnostic
                </Link>
              ) : null}
            </div>
          </article>

          <aside className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-7">
            <p className="font-serif text-xs uppercase tracking-[0.22em] text-[#d2b48c]">
              Attribution
            </p>
            <dl className="mt-4 space-y-4 text-sm text-[rgba(245,235,212,0.85)]">
              <div>
                <dt className="text-[rgba(245,235,212,0.70)]">Asset slug</dt>
                <dd className="mt-1 break-all text-[#f5ebd4]">{asset.slug}</dd>
              </div>
              <div>
                <dt className="text-[rgba(245,235,212,0.70)]">Lead</dt>
                <dd className="mt-1 text-[#f5ebd4]">{asset.company.name}</dd>
              </div>
              <div>
                <dt className="text-[rgba(245,235,212,0.70)]">Original draft</dt>
                <dd className="mt-1 text-[#f5ebd4]">{asset.outreachDraft.id}</dd>
              </div>
              <div>
                <dt className="text-[rgba(245,235,212,0.70)]">Follow-up status</dt>
                <dd className="mt-1 text-[#f5ebd4]">
                  {asset.followUpCreatedAt ? "Locked after first high-intent view" : "Ready"}
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
