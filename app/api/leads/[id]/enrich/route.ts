import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { enrichApolloCompanyAndContacts } from "@/lib/providers/apollo/client";

const enrichmentRequestSchema = z.object({
  persist: z.boolean().optional(),
});

function getCompanyDomain(company: { normalizedDomain: string | null; website: string | null }) {
  if (company.normalizedDomain) {
    return company.normalizedDomain;
  }

  if (company.website) {
    return new URL(company.website).hostname.replace(/^www\./, "");
  }

  throw new Error("Company needs a website or normalized domain before Apollo enrichment.");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const json = await request.json().catch(() => ({}));
    const input = enrichmentRequestSchema.parse(json);
    const { id } = await context.params;

    const company = await db.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        website: true,
        normalizedDomain: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const result = await enrichApolloCompanyAndContacts(
      {
        domain: getCompanyDomain(company),
        companyName: company.name,
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
          error: "Invalid Apollo enrichment request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Apollo enrichment failed.",
      },
      { status: 500 },
    );
  }
}
