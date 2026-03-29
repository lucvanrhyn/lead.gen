import { Prisma } from "@prisma/client";
import { ApprovalStatus, EngagementEventType, OutreachDraftType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFollowUpDraft } from "@/lib/ai/outreach";
import { db } from "@/lib/db";

const engagementSchema = z.object({
  eventType: z.nativeEnum(EngagementEventType),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const input = engagementSchema.parse(await request.json());
    const draft = await db.outreachDraft.findUnique({
      where: { id },
      include: {
        company: {
          select: { name: true },
        },
        contact: {
          select: {
            firstName: true,
            fullName: true,
          },
        },
        childDrafts: {
          where: { draftType: OutreachDraftType.FOLLOW_UP },
          take: 1,
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

    if (
      draft.approvalStatus !== ApprovalStatus.APPROVED &&
      draft.approvalStatus !== ApprovalStatus.PENDING_APPROVAL
    ) {
      return NextResponse.json(
        { error: "Only active outreach drafts can record engagement." },
        { status: 409 },
      );
    }

    if (draft.gmailDraftLink?.syncStatus !== "SYNCED") {
      return NextResponse.json(
        { error: "Engagement can only be logged after the draft has been synced to Gmail." },
        { status: 409 },
      );
    }

    const shouldCreateFollowUp =
      input.eventType !== EngagementEventType.REPLY && draft.childDrafts.length === 0;

    if (!shouldCreateFollowUp) {
      const event = await db.outreachEngagementEvent.create({
        data: {
          outreachDraftId: draft.id,
          companyId: draft.companyId,
          contactId: draft.contactId,
          eventType: input.eventType,
          followUpCreated: false,
        },
      });

      return NextResponse.json({
        event,
        followUpCreated: false,
      });
    }

    const followUpEventType =
      input.eventType === EngagementEventType.REPLY
        ? EngagementEventType.OPEN
        : input.eventType;

    const followUp = buildFollowUpDraft({
      companyName: draft.company.name,
      contactName: draft.contact?.firstName ?? draft.contact?.fullName ?? undefined,
      leadMagnetTitle: draft.emailSubject1,
      engagementType: followUpEventType,
    });

    try {
      const result = await db.$transaction(async (tx) => {
        const followUpDraft = await tx.outreachDraft.create({
          data: {
            companyId: draft.companyId,
            contactId: draft.contactId,
            parentDraftId: draft.id,
            draftType: OutreachDraftType.FOLLOW_UP,
            sequenceStep: draft.sequenceStep + 1,
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

        const event = await tx.outreachEngagementEvent.create({
          data: {
            outreachDraftId: draft.id,
            companyId: draft.companyId,
            contactId: draft.contactId,
            eventType: input.eventType,
            followUpCreated: true,
          },
        });

        return {
          event,
          followUpDraft,
        };
      });

      return NextResponse.json({
        event: result.event,
        followUpCreated: true,
        followUpDraftId: result.followUpDraft.id,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const event = await db.outreachEngagementEvent.create({
          data: {
            outreachDraftId: draft.id,
            companyId: draft.companyId,
            contactId: draft.contactId,
            eventType: input.eventType,
            followUpCreated: false,
          },
        });

        return NextResponse.json({
          event,
          followUpCreated: false,
        });
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid engagement payload.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Recording engagement failed.",
      },
      { status: 500 },
    );
  }
}
