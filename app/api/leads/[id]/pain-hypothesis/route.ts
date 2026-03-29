import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generatePainHypothesis,
  persistPainHypothesis,
} from "@/lib/ai/pain-hypothesis";
import { db } from "@/lib/db";

const painHypothesisRequestSchema = z.object({
  persist: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const json = await request.json().catch(() => ({}));
    const input = painHypothesisRequestSchema.parse(json);
    const { id } = await context.params;

    const company = await db.company.findUnique({
      where: { id },
      include: {
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
        technologyProfiles: {
          orderBy: { confidence: "desc" },
        },
        newsMentions: {
          orderBy: { publishedAt: "desc" },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const hypothesis = await generatePainHypothesis({
      companyName: company.name,
      website: company.website,
      industry: company.industry,
      crawlPages: company.crawlPages,
      technologyProfiles: company.technologyProfiles,
      newsMentions: company.newsMentions,
    });

    if (input.persist !== false) {
      await persistPainHypothesis(company.id, hypothesis);
    }

    return NextResponse.json(hypothesis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid pain hypothesis request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pain hypothesis generation failed.",
      },
      { status: 500 },
    );
  }
}
