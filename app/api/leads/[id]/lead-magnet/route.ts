import { NextResponse } from "next/server";

import { buildLeadMagnet, persistLeadMagnet } from "@/lib/ai/lead-magnet";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const company = await db.company.findUnique({
    where: { id },
    include: {
      painHypotheses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!company || !company.painHypotheses[0]) {
    return NextResponse.json(
      { error: "Generate a pain hypothesis before creating a lead magnet." },
      { status: 400 },
    );
  }

  const latestPain = company.painHypotheses[0];
  const leadMagnet = await buildLeadMagnet({
    companyName: company.name,
    industry: company.industry,
    primaryPain: latestPain.primaryPain,
    recommendedLeadMagnetType: latestPain.recommendedLeadMagnetType,
    recommendedServiceAngle: latestPain.recommendedServiceAngle,
    insufficientEvidence: latestPain.insufficientEvidence,
  });

  await persistLeadMagnet(company.id, leadMagnet);

  return NextResponse.json(leadMagnet);
}
