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
      },
      painHypotheses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      leadMagnets: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      diagnosticForms: {
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

  const latestPain = company.painHypotheses[0];
  const latestLeadMagnet = company.leadMagnets[0];
  const latestForm = company.diagnosticForms[0];
  const contacts =
    company.contacts.length > 0
      ? company.contacts
      : [
          {
            id: undefined,
            firstName: null,
            fullName: null,
          },
        ];

  const drafts = [];

  for (const contact of contacts) {
    const outreach = buildOutreachDraft({
      companyName: company.name,
      contactName: contact.firstName ?? contact.fullName ?? undefined,
      pain: latestPain.primaryPain,
      leadMagnetTitle: latestLeadMagnet.title,
      serviceAngle: latestPain.recommendedServiceAngle,
      diagnosticFormCta: latestForm
        ? {
            mode: "lead_magnet_and_form",
            short: latestForm.outreachCtaShort,
            medium: latestForm.outreachCtaMedium,
          }
        : undefined,
    });

    await persistOutreachDraft({
      companyId: company.id,
      companyName: company.name,
      leadMagnetTitle: latestLeadMagnet.title,
      outreach,
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        title: "title" in contact ? contact.title : undefined,
      },
    });
    drafts.push(outreach);
  }

  return NextResponse.json(drafts[0]);
}
