import {
  ApprovalStatus,
  EnrichmentStage,
  ExternalSyncStatus,
  JobStatus,
  SourceProvider,
  type Prisma,
} from "@prisma/client";

import { buildDiagnosticFormBlueprint, persistDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";
import { buildLeadMagnet, persistLeadMagnet } from "@/lib/ai/lead-magnet";
import {
  buildCampaignAnalytics,
  buildOutreachDraft,
  evaluateOutreachSuppression,
  persistOutreachDraft,
  type OutreachSuppressionReason,
} from "@/lib/ai/outreach";
import { generatePainHypothesis, persistPainHypothesis } from "@/lib/ai/pain-hypothesis";
import { persistLeadScore, scoreLeadContext } from "@/lib/ai/lead-score";
import { db } from "@/lib/db";
import { createLiveDiagnosticFormLink } from "@/lib/domain/diagnostic-form-links";
import { enrichApolloCompanyAndContacts } from "@/lib/providers/apollo/client";
import { extractLeadWebsitePages } from "@/lib/providers/firecrawl/client";

type StageResult = {
  stage: string;
  status: JobStatus;
  error?: string;
};

async function persistPipelineStageOutcome(input: {
  companyId: string;
  provider: SourceProvider;
  stage: EnrichmentStage;
  status: JobStatus;
  error?: string;
  resultSummary?: Prisma.InputJsonObject;
}) {
  try {
    await db.enrichmentJob.create({
      data: {
        companyId: input.companyId,
        provider: input.provider,
        stage: input.stage,
        status: input.status,
        attempts: 1,
        requestedBy: "orchestration.full-pipeline",
        lastError: input.error ?? null,
        resultSummary: input.resultSummary,
      },
    });
  } catch {
    // Preserve the pipeline response even if audit persistence fails.
  }
}

export async function runCompanyFullPipeline(companyId: string) {
  const stages: StageResult[] = [];
  let apolloWarnings: string[] = [];

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: true,
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
        technologyProfiles: true,
        newsMentions: true,
        painHypotheses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
          include: {
            gmailDraftLink: true,
          },
        },
        engagementEvents: {
          orderBy: { occurredAt: "desc" },
        },
      },
    });

    if (!company) {
      return {
        status: JobStatus.FAILED,
        error: "Lead not found.",
        stages,
      };
    }

    try {
      const domain =
        company.normalizedDomain ??
        (company.website ? new URL(company.website).hostname.replace(/^www\./, "") : null);

      if (domain) {
        const enrichment = await enrichApolloCompanyAndContacts(
          {
            domain,
            companyName: company.name,
            persistCompanyId: company.id,
          },
          { persist: true },
        );
        apolloWarnings = enrichment.warnings;
        stages.push({ stage: "enrich", status: JobStatus.SUCCEEDED });
      } else {
        stages.push({ stage: "enrich", status: JobStatus.PARTIAL, error: "No website or domain." });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Apollo enrichment failed.";
      stages.push({
        stage: "enrich",
        status: JobStatus.FAILED,
        error: message,
      });
      await persistPipelineStageOutcome({
        companyId,
        provider: SourceProvider.APOLLO,
        stage: EnrichmentStage.APOLLO_COMPANY_ENRICHMENT,
        status: JobStatus.FAILED,
        error: message,
      });
    }

    const refreshedCompany = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: {
          orderBy: { decisionMakerConfidence: "desc" },
        },
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
        technologyProfiles: true,
        newsMentions: true,
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
          include: {
            gmailDraftLink: true,
          },
        },
        engagementEvents: {
          orderBy: { occurredAt: "desc" },
        },
      },
    });

    if (!refreshedCompany) {
      return {
        status: JobStatus.FAILED,
        error: "Lead disappeared during pipeline run.",
        stages,
      };
    }

    try {
      if (refreshedCompany.website) {
        await extractLeadWebsitePages(
          {
            website: refreshedCompany.website,
            persistCompanyId: refreshedCompany.id,
          },
          { persist: true },
        );
        stages.push({ stage: "crawl", status: JobStatus.SUCCEEDED });
      } else {
        stages.push({ stage: "crawl", status: JobStatus.PARTIAL, error: "No website available." });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Firecrawl extraction failed.";
      stages.push({
        stage: "crawl",
        status: JobStatus.FAILED,
        error: message,
      });
      await persistPipelineStageOutcome({
        companyId,
        provider: SourceProvider.FIRECRAWL,
        stage: EnrichmentStage.FIRECRAWL_EXTRACTION,
        status: JobStatus.FAILED,
        error: message,
      });
    }

    const companyWithEvidence = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: {
          orderBy: { decisionMakerConfidence: "desc" },
        },
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
        technologyProfiles: true,
        newsMentions: true,
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
          include: {
            gmailDraftLink: true,
          },
        },
        engagementEvents: {
          orderBy: { occurredAt: "desc" },
        },
      },
    });

    if (!companyWithEvidence) {
      return {
        status: JobStatus.FAILED,
        error: "Lead disappeared before AI stages.",
        stages,
      };
    }

    let painHypothesis: Awaited<ReturnType<typeof generatePainHypothesis>>;

    try {
      painHypothesis = await generatePainHypothesis({
        companyName: companyWithEvidence.name,
        website: companyWithEvidence.website,
        industry: companyWithEvidence.industry,
        crawlPages: companyWithEvidence.crawlPages,
        technologyProfiles: companyWithEvidence.technologyProfiles,
        newsMentions: companyWithEvidence.newsMentions,
      });
      await persistPainHypothesis(companyId, painHypothesis);
      stages.push({
        stage: "pain-hypothesis",
        status: painHypothesis.insufficient_evidence ? JobStatus.PARTIAL : JobStatus.SUCCEEDED,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pain hypothesis generation failed.";
      await persistPipelineStageOutcome({
        companyId,
        provider: SourceProvider.OPENAI,
        stage: EnrichmentStage.PAIN_HYPOTHESIS_GENERATION,
        status: JobStatus.FAILED,
        error: message,
      });
      stages.push({
        stage: "pain-hypothesis",
        status: JobStatus.FAILED,
        error: message,
      });

      return {
        status: JobStatus.FAILED,
        error: message,
        stages,
      };
    }

    try {
      const score = scoreLeadContext({
        hasIndustry: Boolean(companyWithEvidence.industry),
        employeeCount: companyWithEvidence.employeeCount,
        hasWebsite: Boolean(companyWithEvidence.website),
        hasPhone: Boolean(companyWithEvidence.phone),
        hasLocation: Boolean(companyWithEvidence.locationSummary),
        contacts: companyWithEvidence.contacts.map((contact) => ({
          hasEmail: Boolean(contact.email),
          hasPhone: Boolean(contact.phone),
          decisionMakerConfidence: contact.decisionMakerConfidence,
        })),
        painConfidence: painHypothesis.confidence_score,
        painEvidenceCount: painHypothesis.evidence.length,
        insufficientEvidence: painHypothesis.insufficient_evidence,
        hasTechnologyProfile: companyWithEvidence.technologyProfiles.length > 0,
        newsMentionsCount: companyWithEvidence.newsMentions.length,
      });
      await persistLeadScore(companyId, score);
      stages.push({ stage: "score", status: JobStatus.SUCCEEDED });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead scoring failed.";
      await persistPipelineStageOutcome({
        companyId,
        provider: SourceProvider.SYSTEM,
        stage: EnrichmentStage.LEAD_SCORING,
        status: JobStatus.FAILED,
        error: message,
      });
      stages.push({
        stage: "score",
        status: JobStatus.FAILED,
        error: message,
      });

      return {
        status: JobStatus.FAILED,
        error: message,
        stages,
      };
    }

    let leadMagnet: ReturnType<typeof buildLeadMagnet>;
    let persistedLeadMagnet: Awaited<ReturnType<typeof persistLeadMagnet>>;

    try {
      leadMagnet = buildLeadMagnet({
        companyName: companyWithEvidence.name,
        primaryPain: painHypothesis.primary_pain,
        recommendedLeadMagnetType: painHypothesis.recommended_lead_magnet_type,
        recommendedServiceAngle: painHypothesis.recommended_service_angle,
        insufficientEvidence: painHypothesis.insufficient_evidence,
      });
      persistedLeadMagnet = await persistLeadMagnet(companyId, leadMagnet);
      stages.push({ stage: "lead-magnet", status: JobStatus.SUCCEEDED });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lead magnet generation failed.";
      await persistPipelineStageOutcome({
        companyId,
        provider: SourceProvider.SYSTEM,
        stage: EnrichmentStage.LEAD_MAGNET_GENERATION,
        status: JobStatus.FAILED,
        error: message,
      });
      stages.push({
        stage: "lead-magnet",
        status: JobStatus.FAILED,
        error: message,
      });

      return {
        status: JobStatus.FAILED,
        error: message,
        stages,
      };
    }

    let diagnosticForm: ReturnType<typeof buildDiagnosticFormBlueprint>;
    let persistedDiagnosticForm: Awaited<ReturnType<typeof persistDiagnosticFormBlueprint>>;
    const persistedPain = await db.painHypothesis.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    try {
      diagnosticForm = buildDiagnosticFormBlueprint({
        companyName: companyWithEvidence.name,
        industry: companyWithEvidence.industry,
        primaryPain: painHypothesis.primary_pain,
        serviceAngle: painHypothesis.recommended_service_angle,
      });
      persistedDiagnosticForm = await persistDiagnosticFormBlueprint({
        companyId,
        painHypothesisId: persistedPain?.id,
        blueprint: diagnosticForm,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Diagnostic form generation failed.";
      stages.push({
        stage: "diagnostic-form",
        status: JobStatus.FAILED,
        error: message,
      });

      return {
        status: JobStatus.FAILED,
        error: message,
        stages,
      };
    }

    let diagnosticFormUrl: string | null = null;
    let diagnosticFormStatus: JobStatus = JobStatus.SUCCEEDED;
    let diagnosticFormError: string | undefined;

    try {
      const liveForm = await createLiveDiagnosticFormLink({
        blueprintId: persistedDiagnosticForm.id,
        blueprint: diagnosticForm,
      });
      diagnosticFormUrl = liveForm?.responderUrl ?? null;
    } catch (error) {
      diagnosticFormStatus = JobStatus.PARTIAL;
      diagnosticFormError =
        error instanceof Error ? error.message : "Creating the live diagnostic form failed.";
    }

    stages.push({
      stage: "diagnostic-form",
      status: diagnosticFormStatus,
      error: diagnosticFormError,
    });

    const contacts = companyWithEvidence.contacts.filter((contact) => Boolean(contact.email));

    if (contacts.length === 0) {
      const noContactsReason =
        apolloWarnings[0] ?? "No valid contacts with email were available for draft generation.";

      await db.enrichmentJob.create({
        data: {
          companyId,
          provider: SourceProvider.SYSTEM,
          stage: EnrichmentStage.OUTREACH_GENERATION,
          status: JobStatus.PARTIAL,
          attempts: 1,
          requestedBy: "orchestration.full-pipeline",
          resultSummary: {
            campaignAnalytics: {
              sentCount: 0,
              viewedCount: 0,
              repliedCount: 0,
              followUpDueCount: 0,
              suppressedCount: 0,
            },
            suppressedContacts: [],
            generatedDraftCount: 0,
            suppressedContactCount: 0,
            note: noContactsReason,
          },
        },
      });

      stages.push({
        stage: "outreach",
        status: JobStatus.PARTIAL,
        error: noContactsReason,
      });

      return {
        status: JobStatus.PARTIAL,
        stages,
      };
    }

    const campaignDrafts: Array<{
      id: string;
      companyId: string;
      approvalStatus: ApprovalStatus;
      gmailSyncStatus: ExternalSyncStatus;
      suppressionReason: OutreachSuppressionReason | null;
    }> = companyWithEvidence.outreachDrafts.map((draft) => ({
      id: draft.id,
      companyId: draft.companyId,
      approvalStatus: draft.approvalStatus,
      gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? ExternalSyncStatus.NOT_READY,
      suppressionReason: null,
    }));
    const suppressedContacts: Array<{
      contactId: string;
      contactName: string | null;
      contactEmail: string | null;
      reason: OutreachSuppressionReason | null;
      note?: string;
      cooldownUntil?: string;
    }> = [];
    let suppressedContactCount = 0;

    for (const contact of contacts) {
      const suppression = evaluateOutreachSuppression({
        companyId: companyWithEvidence.id,
        contactId: contact.id,
        recentDrafts: companyWithEvidence.outreachDrafts.map((draft) => ({
          id: draft.id,
          companyId: draft.companyId,
          contactId: draft.contactId,
          createdAt: draft.createdAt,
          approvalStatus: draft.approvalStatus,
          gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? ExternalSyncStatus.NOT_READY,
        })),
        engagementEvents: companyWithEvidence.engagementEvents.map((event) => ({
          id: event.id,
          outreachDraftId: event.outreachDraftId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
        })),
      });

      if (suppression.suppressed) {
        suppressedContactCount += 1;
        suppressedContacts.push({
          contactId: contact.id,
          contactName: contact.fullName,
          contactEmail: contact.email,
          reason: suppression.reason ?? null,
          note: suppression.note,
          cooldownUntil: suppression.cooldownUntil?.toISOString(),
        });
        campaignDrafts.push({
          id: `suppressed-${contact.id}`,
          companyId: companyWithEvidence.id,
          approvalStatus: "PENDING_APPROVAL",
          gmailSyncStatus: ExternalSyncStatus.NOT_READY,
          suppressionReason: suppression.reason ?? null,
        });
        continue;
      }

      const outreach = buildOutreachDraft({
        companyName: companyWithEvidence.name,
        contactName: contact.firstName ?? contact.fullName ?? undefined,
        pain: painHypothesis.primary_pain,
        leadMagnetTitle: leadMagnet.title,
        serviceAngle: painHypothesis.recommended_service_angle,
        diagnosticFormCta: {
          mode: "lead_magnet_and_form",
          short: diagnosticForm.outreach_cta_short,
          medium: diagnosticForm.outreach_cta_medium,
        },
      });

      await persistOutreachDraft({
        companyId,
        companyName: companyWithEvidence.name,
        leadMagnet: {
          id: persistedLeadMagnet.id,
          title: persistedLeadMagnet.title,
          summary: persistedLeadMagnet.summary,
          whyItMatchesTheLead: persistedLeadMagnet.whyItMatchesTheLead,
          suggestedDeliveryFormat: persistedLeadMagnet.suggestedDeliveryFormat,
        },
        outreach,
        diagnosticFormUrl,
        contact: {
          id: contact.id,
          fullName: contact.fullName,
          title: "title" in contact ? contact.title : undefined,
        },
      });

      campaignDrafts.push({
        id: `generated-${contact.id}`,
        companyId: companyWithEvidence.id,
        approvalStatus: "PENDING_APPROVAL",
        gmailSyncStatus: ExternalSyncStatus.NOT_READY,
        suppressionReason: null,
      });
    }
    const campaignAnalytics = buildCampaignAnalytics({
      drafts: campaignDrafts,
      engagementEvents: companyWithEvidence.engagementEvents.map((event) => ({
        id: event.id,
        outreachDraftId: event.outreachDraftId,
        eventType: event.eventType,
      })),
    });
    const outreachStatus = suppressedContactCount > 0 ? JobStatus.PARTIAL : JobStatus.SUCCEEDED;

    await db.enrichmentJob.create({
      data: {
        companyId,
        provider: SourceProvider.SYSTEM,
        stage: EnrichmentStage.OUTREACH_GENERATION,
        status: outreachStatus,
        attempts: 1,
        requestedBy: "orchestration.full-pipeline",
        resultSummary: {
          campaignAnalytics,
          suppressedContacts,
          generatedDraftCount: contacts.length - suppressedContactCount,
          suppressedContactCount,
        },
      },
    });

    stages.push({
      stage: "outreach",
      status: outreachStatus,
      error:
        suppressedContactCount > 0
          ? `${suppressedContactCount} contact${suppressedContactCount === 1 ? "" : "s"} suppressed.`
          : undefined,
    });

    return {
      status: stages.some((stage) => stage.status === JobStatus.FAILED)
        ? JobStatus.PARTIAL
        : stages.some((stage) => stage.status === JobStatus.PARTIAL)
          ? JobStatus.PARTIAL
          : JobStatus.SUCCEEDED,
      stages,
      campaignAnalytics,
    };
  } catch (error) {
    return {
      status: JobStatus.FAILED,
      error: error instanceof Error ? error.message : "Full pipeline failed.",
      stages,
    };
  }
}
