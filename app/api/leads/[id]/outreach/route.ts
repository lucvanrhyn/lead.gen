import { NextResponse } from "next/server";

import { buildOutreachDraft, persistOutreachDraft } from "@/lib/ai/outreach";
import { db } from "@/lib/db";

function getNoContactsError(job?: {
  lastError?: string | null;
  resultSummary?: unknown;
}) {
  if (job?.lastError) {
    return job.lastError;
  }

  if (
    job?.resultSummary &&
    typeof job.resultSummary === "object" &&
    !Array.isArray(job.resultSummary) &&
    "warnings" in job.resultSummary &&
    Array.isArray(job.resultSummary.warnings)
  ) {
    const warning = job.resultSummary.warnings.find((value): value is string => typeof value === "string");

    if (warning) {
      return warning;
    }
  }

  return "No valid contacts with email were available for outreach drafts.";
}

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
        include: {
          formLink: true,
        },
      },
      enrichmentJobs: {
        where: {
          stage: "APOLLO_PEOPLE_ENRICHMENT",
        },
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
  const contacts = company.contacts.filter((contact) => Boolean(contact.email));

  if (contacts.length === 0) {
    return NextResponse.json(
      { error: getNoContactsError(company.enrichmentJobs[0]) },
      { status: 422 },
    );
  }

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
      leadMagnet: {
        id: latestLeadMagnet.id,
        title: latestLeadMagnet.title,
        summary: latestLeadMagnet.summary,
        whyItMatchesTheLead: latestLeadMagnet.whyItMatchesTheLead,
        suggestedDeliveryFormat: latestLeadMagnet.suggestedDeliveryFormat,
      },
      outreach,
      diagnosticFormUrl: latestForm?.formLink?.url ?? null,
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
