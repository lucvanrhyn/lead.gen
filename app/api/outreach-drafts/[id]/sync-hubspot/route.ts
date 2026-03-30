import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  isHubSpotConfigured,
  syncOutreachDraftToHubSpot,
} from "@/lib/providers/hubspot/client";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isHubSpotConfigured()) {
    return NextResponse.json({
      mirrored: false,
      skipped: true,
      reason: "HUBSPOT_PRIVATE_APP_TOKEN is not configured.",
    });
  }

  try {
    const { id } = await context.params;
    const draft = await db.outreachDraft.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            website: true,
            normalizedDomain: true,
            phone: true,
            industry: true,
          },
        },
        contact: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            email: true,
            title: true,
            phone: true,
          },
        },
        engagementEvents: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: {
            id: true,
            eventType: true,
            occurredAt: true,
            payload: true,
          },
        },
        gmailDraftLink: {
          select: {
            syncStatus: true,
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
    }

    if (draft.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved outreach drafts can sync to HubSpot." },
        { status: 409 },
      );
    }

    if (draft.gmailDraftLink?.syncStatus !== "SYNCED") {
      return NextResponse.json(
        { error: "Sync HubSpot only after the draft has been handed off to Gmail." },
        { status: 409 },
      );
    }

    const result = await syncOutreachDraftToHubSpot(
      {
        company: draft.company,
        contact: draft.contact ?? undefined,
        draft: {
          id: draft.id,
          emailSubject1: draft.emailSubject1,
          draftType: draft.draftType,
          sequenceStep: draft.sequenceStep,
        },
        event: draft.engagementEvents[0]
          ? {
              id: draft.engagementEvents[0].id,
              eventType: draft.engagementEvents[0].eventType,
              occurredAt: draft.engagementEvents[0].occurredAt,
              payload: draft.engagementEvents[0].payload,
            }
          : null,
      },
      {
        fetchImpl: fetch,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Syncing to HubSpot failed.",
      },
      { status: 500 },
    );
  }
}
