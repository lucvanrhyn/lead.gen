import { NextResponse } from "next/server";

import { scoreLeadContext, persistLeadScore } from "@/lib/ai/lead-score";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const company = await db.company.findUnique({
    where: { id },
    include: {
      contacts: true,
      painHypotheses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      technologyProfiles: true,
      newsMentions: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const latestPain = company.painHypotheses[0];
  const score = scoreLeadContext({
    hasIndustry: Boolean(company.industry),
    employeeCount: company.employeeCount,
    hasWebsite: Boolean(company.website),
    hasPhone: Boolean(company.phone),
    hasLocation: Boolean(company.locationSummary),
    contacts: company.contacts.map((contact) => ({
      hasEmail: Boolean(contact.email),
      hasPhone: Boolean(contact.phone),
      decisionMakerConfidence: contact.decisionMakerConfidence,
    })),
    painConfidence: latestPain?.confidenceScore,
    painEvidenceCount: Array.isArray(latestPain?.evidence) ? latestPain.evidence.length : 0,
    insufficientEvidence: latestPain?.insufficientEvidence ?? true,
    hasTechnologyProfile: company.technologyProfiles.length > 0,
    newsMentionsCount: company.newsMentions.length,
  });

  await persistLeadScore(company.id, score);

  return NextResponse.json(score);
}
