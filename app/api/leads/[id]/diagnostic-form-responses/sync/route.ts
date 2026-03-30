import { DiagnosticFormResponseStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { persistLeadScore, scoreLeadContext } from "@/lib/ai/lead-score";
import { db } from "@/lib/db";
import { syncGoogleWorkspaceDiagnosticResponses } from "@/lib/providers/google-workspace/forms";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/leads/[id]/diagnostic-form-responses/sync">,
) {
  const { id } = await context.params;

  const latestBlueprint = await db.diagnosticFormBlueprint.findFirst({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    include: { formLink: true },
  });

  if (!latestBlueprint?.formLink?.url) {
    return NextResponse.json(
      { error: "Attach or create a live Google Form before syncing responses." },
      { status: 409 },
    );
  }

  const connection = await db.googleWorkspaceConnection.findUnique({
    where: { provider: "google_workspace" },
  });

  if (!connection || connection.status !== "CONNECTED") {
    return NextResponse.json(
      { error: "Google Workspace is not connected yet." },
      { status: 503 },
    );
  }

  try {
    const auth = await createAuthorizedGoogleClient(connection);
    const synced = await syncGoogleWorkspaceDiagnosticResponses({
      auth,
      formUrl: latestBlueprint.formLink.url,
    });

    if (!synced.latestResponse) {
      return NextResponse.json({
        responseCount: 0,
        updated: false,
      });
    }

    const responseSummary = synced.latestResponse.summary;
    const company = await db.company.findUnique({
      where: { id },
      include: {
        contacts: true,
        painHypotheses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let scoreImpact: Prisma.InputJsonValue | undefined;

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
        formResponse: {
          status: DiagnosticFormResponseStatus.RESPONDED,
          urgencyLevel: responseSummary.urgencyLevel,
          budgetReadiness: responseSummary.budgetReadiness,
          workflowDetailDepth: responseSummary.workflowDetailDepth,
        },
      });
      await persistLeadScore(company.id, updatedScore);
      scoreImpact = {
        totalScore: updatedScore.total_score,
        urgencySignals: updatedScore.components.urgency_signals,
        outreachConfidence: updatedScore.components.outreach_confidence,
      };
    }

    const formLink = await db.diagnosticFormLink.update({
      where: { blueprintId: latestBlueprint.id },
      data: {
        responseStatus: DiagnosticFormResponseStatus.RESPONDED,
        responseSummary,
        scoreImpact,
      },
    });

    return NextResponse.json({
      responseCount: synced.responseCount,
      latestResponse: synced.latestResponse,
      formLink,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Syncing Google Form responses failed.",
      },
      { status: 500 },
    );
  }
}
