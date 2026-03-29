import { NextResponse } from "next/server";

import { buildDiagnosticFormBlueprint, persistDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/leads/[id]/diagnostic-form">,
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
      { error: "Generate a pain hypothesis before creating a diagnostic form." },
      { status: 400 },
    );
  }

  const latestPain = company.painHypotheses[0];
  const blueprint = buildDiagnosticFormBlueprint({
    companyName: company.name,
    industry: company.industry,
    primaryPain: latestPain.primaryPain,
    serviceAngle: latestPain.recommendedServiceAngle,
  });

  const persisted = await persistDiagnosticFormBlueprint({
    companyId: company.id,
    painHypothesisId: latestPain.id,
    blueprint,
  });

  return NextResponse.json({
    id: persisted.id,
    ...blueprint,
  });
}
