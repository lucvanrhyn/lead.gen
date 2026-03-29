import { NextResponse } from "next/server";

import { buildOutreachDraft, persistOutreachDraft } from "@/lib/ai/outreach";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const company = await db.company.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { decisionMakerConfidence: "desc" },
        take: 1,
      },
      painHypotheses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      leadMagnets: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!company || !company.painHypotheses[0] || !company.leadMagnets[0]) {
    return NextResponse.json(
      { error: "Generate a pain hypothesis and lead magnet before drafting outreach." },
      { status: 400 },
    );
  }

  const contact = company.contacts[0];
  const latestPain = company.painHypotheses[0];
  const latestLeadMagnet = company.leadMagnets[0];

  const outreach = buildOutreachDraft({
    companyName: company.name,
    contactName: contact?.firstName ?? contact?.fullName,
    pain: latestPain.primaryPain,
    leadMagnetTitle: latestLeadMagnet.title,
    serviceAngle: latestPain.recommendedServiceAngle,
  });

  await persistOutreachDraft(company.id, outreach, contact?.id);

  return NextResponse.json(outreach);
}
