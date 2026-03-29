import { DiagnosticFormResponseStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { diagnosticFormResponseSummarySchema } from "@/lib/ai/diagnostic-form";
import { persistLeadScore, scoreLeadContext } from "@/lib/ai/lead-score";
import { db } from "@/lib/db";
import { deriveDiagnosticResponseStatus } from "@/lib/domain/diagnostic-forms";

const formLinkRequestSchema = z.object({
  url: z.string().url().optional(),
  responseStatus: z.nativeEnum(DiagnosticFormResponseStatus).optional(),
  responseSummary: diagnosticFormResponseSummarySchema.optional(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/leads/[id]/diagnostic-form-link">,
) {
  try {
    const { id } = await context.params;
    const input = formLinkRequestSchema.parse(await request.json().catch(() => ({})));

    const latestBlueprint = await db.diagnosticFormBlueprint.findFirst({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      include: { formLink: true },
    });

    if (!latestBlueprint) {
      return NextResponse.json(
        { error: "Generate a diagnostic form before saving a live form link." },
        { status: 400 },
      );
    }

    const responseStatus =
      input.responseStatus ??
      deriveDiagnosticResponseStatus(input.url, input.responseSummary);

    let scoreImpact: Prisma.InputJsonValue | undefined;

    if (input.responseSummary) {
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

      if (company) {
        const latestPain = company.painHypotheses[0];
        const updatedScore = scoreLeadContext({
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
          formResponse: {
            status: responseStatus,
            urgencyLevel: input.responseSummary.urgencyLevel,
            budgetReadiness: input.responseSummary.budgetReadiness,
            workflowDetailDepth: input.responseSummary.workflowDetailDepth,
          },
        });
        await persistLeadScore(company.id, updatedScore);
        scoreImpact = {
          totalScore: updatedScore.total_score,
          urgencySignals: updatedScore.components.urgency_signals,
          outreachConfidence: updatedScore.components.outreach_confidence,
        };
      }
    }

    const formLink = latestBlueprint.formLink
      ? await db.diagnosticFormLink.update({
          where: { blueprintId: latestBlueprint.id },
          data: {
            url: input.url ?? latestBlueprint.formLink.url,
            responseStatus,
            responseSummary: input.responseSummary,
            scoreImpact,
          },
        })
      : await db.diagnosticFormLink.create({
          data: {
            blueprintId: latestBlueprint.id,
            url: input.url ?? "https://forms.google.com",
            responseStatus,
            responseSummary: input.responseSummary,
            scoreImpact,
          },
        });

    return NextResponse.json(formLink);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid form link request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Saving the form link failed.",
      },
      { status: 500 },
    );
  }
}
