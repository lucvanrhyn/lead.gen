import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { extractLeadWebsitePages } from "@/lib/providers/firecrawl/client";

const crawlRequestSchema = z.object({
  persist: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const json = await request.json().catch(() => ({}));
    const input = crawlRequestSchema.parse(json);
    const { id } = await context.params;

    const company = await db.company.findUnique({
      where: { id },
      select: {
        id: true,
        website: true,
      },
    });

    if (!company?.website) {
      return NextResponse.json(
        {
          error: "Lead needs a public website before Firecrawl extraction.",
        },
        { status: 400 },
      );
    }

    const result = await extractLeadWebsitePages(
      {
        website: company.website,
        persistCompanyId: input.persist === false ? undefined : company.id,
      },
      {
        persist: input.persist,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid crawl request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Firecrawl extraction failed.",
      },
      { status: 500 },
    );
  }
}
