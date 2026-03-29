import { ApprovalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const rejectRequestSchema = z.object({
  notes: z.string().min(1).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = rejectRequestSchema.parse(await request.json().catch(() => ({})));

    const draft = await db.outreachDraft.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvalNotes: input.notes,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid reject request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Rejecting the draft failed.",
      },
      { status: 500 },
    );
  }
}
