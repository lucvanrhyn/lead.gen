import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const manualReviewSchema = z.object({
  manualReviewRequired: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const json = await request.json();
    const input = manualReviewSchema.parse(json);
    const { id } = await context.params;

    const company = await db.company.update({
      where: { id },
      data: {
        manualReviewRequired: input.manualReviewRequired,
      },
      select: {
        id: true,
        manualReviewRequired: true,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid manual review request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update review state.",
      },
      { status: 500 },
    );
  }
}
