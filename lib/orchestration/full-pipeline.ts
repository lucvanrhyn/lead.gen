import {
  ApprovalStatus,
  CompanyStatus,
  EnrichmentStage,
  ExternalSyncStatus,
  JobStatus,
  SourceProvider,
  type Prisma,
} from "@prisma/client";

import { persistBusinessContext } from "@/lib/ai/business-context";
import { extractBusinessContextAndPain } from "@/lib/ai/business-context-and-pain";
import { buildDiagnosticFormBlueprint, persistDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";
import { buildLeadMagnet, persistLeadMagnet } from "@/lib/ai/lead-magnet";
import {
  buildCampaignAnalytics,
  evaluateOutreachSuppression,
  generateOutreachDraft,
  mapLlmOutreachToOutreachSchema,
  persistOutreachDraft,
  type OutreachSuppressionReason,
} from "@/lib/ai/outreach";
import { persistPainHypothesis } from "@/lib/ai/pain-hypothesis";
import { generateLeadScore, persistLeadScore, scoreLeadContext } from "@/lib/ai/lead-score";
import { runQaCheck, persistQaCheckResult } from "@/lib/ai/qa-check";
import { resolvePlaybook } from "@/lib/config/playbooks";
import { db } from "@/lib/db";
import { createLiveDiagnosticFormLink } from "@/lib/domain/diagnostic-form-links";
import { createFollowUpSkeletons } from "@/lib/domain/follow-up-scheduler";
import { enrichApolloCompanyAndContacts } from "@/lib/providers/apollo/client";
import {
  extractLeadWebsitePages,
  extractEmailsFromPages,
  persistContactsFromCrawl,
  type NormalizedFirecrawlPage,
} from "@/lib/providers/firecrawl/client";
import { fetchGoogleReviews } from "@/lib/providers/google-reviews";
import { extractPainSignals, type ReviewPainSignals } from "@/lib/domain/review-signals";
import { runEmailDiscoveryCascade } from "@/lib/orchestration/email-cascade";

type StageResult = {
  stage: string;
  status: JobStatus;
  error?: string;
  skipped?: boolean;
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
  } catch (error) {
    // Preserve the pipeline response even if audit persistence fails.
    console.warn("[full-pipeline] Non-fatal: Failed to persist pipeline stage outcome:", error);
  }
}

export async function runCompanyFullPipeline(companyId: string) {
  const stages: StageResult[] = [];
  let apolloWarnings: string[] = [];

  // Stale lock recovery: if a company has been ENRICHING for >15 minutes,
  // the previous run likely crashed. Force-release the lock.
  const STALE_LOCK_THRESHOLD_MS = 15 * 60 * 1000;
  await db.company.updateMany({
    where: {
      id: companyId,
      status: CompanyStatus.ENRICHING,
      updatedAt: { lt: new Date(Date.now() - STALE_LOCK_THRESHOLD_MS) },
    },
    data: { status: CompanyStatus.READY },
  });

  // Stale enrichment job recovery: mark jobs stuck in RUNNING for >15 min as FAILED.
  const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000;
  await db.enrichmentJob.updateMany({
    where: {
      companyId,
      status: JobStatus.RUNNING,
      updatedAt: { lt: new Date(Date.now() - STALE_JOB_THRESHOLD_MS) },
    },
    data: {
      status: JobStatus.FAILED,
      lastError: "Job timed out — marked as failed by stale job recovery.",
    },
  });

  // Stale enrichment job recovery: mark jobs stuck in PENDING for >15 min as FAILED.
  await db.enrichmentJob.updateMany({
    where: {
      companyId,
      status: JobStatus.PENDING,
      updatedAt: { lt: new Date(Date.now() - STALE_JOB_THRESHOLD_MS) },
    },
    data: {
      status: JobStatus.FAILED,
      lastError: "Job timed out while pending — marked as failed by stale job recovery.",
    },
  });

  // Concurrency guard: atomically set status to ENRICHING, reject if already running.
  const lockResult = await db.company.updateMany({
    where: { id: companyId, status: { not: CompanyStatus.ENRICHING } },
    data: { status: CompanyStatus.ENRICHING },
  });

  if (lockResult.count === 0) {
    return {
      status: JobStatus.PARTIAL,
      error: "Pipeline is already running for this company.",
      stages: [{ stage: "lock", status: JobStatus.PARTIAL, error: "Pipeline already in progress" }],
    };
  }

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: true,
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
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

    const alreadyEnriched = company.apolloOrganizationId !== null || company.employeeCount !== null;
    if (alreadyEnriched) {
      stages.push({ stage: "enrich", status: JobStatus.SUCCEEDED, skipped: true });
    } else {
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

    let crawlEmails: string[] = [];
    const alreadyCrawled = refreshedCompany.crawlPages.length > 0;
    if (alreadyCrawled) {
      // Re-extract emails from already-crawled pages so downstream email cascade
      // still works correctly without re-spending Firecrawl credits.
      crawlEmails = extractEmailsFromPages(
        refreshedCompany.crawlPages.map((p) => ({
          pageType: p.pageType,
          url: p.url,
          title: p.title ?? undefined,
          markdown: p.markdown ?? undefined,
          confidence: p.confidence ?? 0,
          // `raw` is not stored in the DB; extractEmailsFromPages only reads markdown
          raw: {} as NormalizedFirecrawlPage["raw"],
        })),
      );
      stages.push({ stage: "crawl", status: JobStatus.SUCCEEDED, skipped: true });
    } else {
      try {
        if (refreshedCompany.website) {
          const crawlResult = await extractLeadWebsitePages(
            {
              website: refreshedCompany.website,
              persistCompanyId: refreshedCompany.id,
            },
            { persist: true },
          );
          // Extract emails from crawled pages as a fallback when Apollo People Search
          // is unavailable — ensures contacts exist even without a full Apollo plan.
          crawlEmails = extractEmailsFromPages(crawlResult.pages);
          await persistContactsFromCrawl(refreshedCompany.id, crawlEmails);
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
    }

    // Email discovery cascade: Firecrawl → Hunter.io → Google Places phone fallback
    const existingEmailContacts = refreshedCompany.contacts.filter((c) => Boolean(c.email));
    if (existingEmailContacts.length > 0) {
      stages.push({ stage: "email_cascade", status: JobStatus.SUCCEEDED, skipped: true });
    } else {
      const cascadeDomain =
        refreshedCompany.normalizedDomain ??
        (refreshedCompany.website
          ? new URL(refreshedCompany.website).hostname.replace(/^www\./, "")
          : null);
      const cascadeResult = await runEmailDiscoveryCascade({
        companyId,
        domain: cascadeDomain,
        companyName: refreshedCompany.name,
        crawlEmails,
        existingContacts: refreshedCompany.contacts.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
        })),
        phone: refreshedCompany.phone ?? null,
      });
      stages.push({
        stage: "email_cascade",
        status: cascadeResult.contactsCreated > 0 ? JobStatus.SUCCEEDED : JobStatus.PARTIAL,
        error: cascadeResult.warnings.length > 0 ? cascadeResult.warnings.join("; ") : undefined,
      });
    }

    // Check if any email contacts exist after the cascade. If not, the lead
    // still gets full AI analysis (pain hypothesis, lead magnet, LinkedIn tasks)
    // but email outreach will be skipped. This ensures phone/LinkedIn-only leads
    // are still actionable.
    const emailContacts = await db.contact.findMany({
      where: { companyId, email: { not: null } },
      select: { id: true },
    });
    const hasEmailContacts = emailContacts.length > 0;
    if (!hasEmailContacts) {
      stages.push({
        stage: "email_status",
        status: JobStatus.PARTIAL,
        error: "No email found — lead will be processed for LinkedIn/phone outreach only.",
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

    // Resolve industry playbook
    const playbook = resolvePlaybook(companyWithEvidence.industry);

    // Fetch Google reviews as a pain-hypothesis signal (non-fatal)
    let reviewSignals: ReviewPainSignals | null = null;
    if (companyWithEvidence.googlePlaceId) {
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
        const reviews = await fetchGoogleReviews(companyWithEvidence.googlePlaceId, { apiKey });
        if (reviews.length > 0) {
          reviewSignals = extractPainSignals(reviews);
        }
        stages.push({
          stage: "google-reviews",
          status: reviews.length > 0 ? JobStatus.SUCCEEDED : JobStatus.PARTIAL,
          error: reviews.length === 0 ? "No reviews found for this place." : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Google reviews fetch failed.";
        stages.push({ stage: "google-reviews", status: JobStatus.PARTIAL, error: message });
        // Non-fatal — continue pipeline without review signals
      }
    }

    // Combined business context + pain hypothesis extraction (single LLM call)
    let businessContext: Awaited<ReturnType<typeof extractBusinessContextAndPain>>["business_context"] | null = null;
    let painHypothesis: Awaited<ReturnType<typeof extractBusinessContextAndPain>>["pain_hypothesis"];

    const existingBusinessContext = await db.businessContext.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    const existingPainHypothesis = await db.painHypothesis.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    if (existingBusinessContext && existingPainHypothesis) {
      // Reconstruct from rawPayload if available, otherwise from DB fields.
      businessContext = existingBusinessContext.rawPayload
        ? (existingBusinessContext.rawPayload as unknown as NonNullable<typeof businessContext>)
        : {
            website_summary: existingBusinessContext.websiteSummary,
            services_offerings: existingBusinessContext.servicesOfferings as string[],
            customer_type: existingBusinessContext.customerType as "b2b" | "b2c" | "mixed" | "unclear",
            weak_lead_capture_signals: (existingBusinessContext.weakLeadCaptureSignals as string[] | null) ?? [],
            operational_clues: (existingBusinessContext.operationalClues as string[] | null) ?? [],
            urgency_signals: (existingBusinessContext.urgencySignals as string[] | null) ?? [],
            decision_maker_clues: (existingBusinessContext.decisionMakerClues as string[] | null) ?? [],
            tone_brand_clues: (existingBusinessContext.toneBrandClues as string[] | null) ?? [],
          };

      painHypothesis = existingPainHypothesis.rawPayload
        ? (existingPainHypothesis.rawPayload as typeof painHypothesis)
        : {
            primary_pain: existingPainHypothesis.primaryPain,
            secondary_pains: existingPainHypothesis.secondaryPains as string[],
            evidence: existingPainHypothesis.evidence as Array<{
              source_type: string;
              source_url: string;
              snippet: string;
              signal_type: string;
              confidence: number;
            }>,
            business_impact: existingPainHypothesis.businessImpact,
            confidence_score: existingPainHypothesis.confidenceScore,
            recommended_service_angle: existingPainHypothesis.recommendedServiceAngle,
            recommended_lead_magnet_type: existingPainHypothesis.recommendedLeadMagnetType,
            insufficient_evidence: existingPainHypothesis.insufficientEvidence,
            company_summary: existingPainHypothesis.companySummary ?? "",
            observed_signals: (existingPainHypothesis.observedFacts as Array<{
              signal: string;
              source: string;
              confidence: number;
              category: "observed" | "inferred" | "speculative";
            }> | null) ?? [],
            likely_pains: [
              ...((existingPainHypothesis.reasonableInferences as Array<{
                pain: string;
                category: "observed" | "inferred" | "speculative";
                evidence_refs: string[];
              }> | null) ?? []),
              ...((existingPainHypothesis.speculativeAssumptions as Array<{
                pain: string;
                category: "observed" | "inferred" | "speculative";
                evidence_refs: string[];
              }> | null) ?? []),
            ],
            best_outreach_angle: existingPainHypothesis.bestOutreachAngle ?? "",
            caution_do_not_claim: (existingPainHypothesis.cautionNotes as string[] | null) ?? [],
          };

      stages.push({ stage: "business-context", status: JobStatus.SUCCEEDED, skipped: true });
      stages.push({
        stage: "pain-hypothesis",
        status: painHypothesis.insufficient_evidence ? JobStatus.PARTIAL : JobStatus.SUCCEEDED,
        skipped: true,
      });
    } else {
      try {
        const combined = await extractBusinessContextAndPain(
          {
            companyName: companyWithEvidence.name,
            website: companyWithEvidence.website,
            industry: companyWithEvidence.industry,
            crawlPages: companyWithEvidence.crawlPages,
          },
          {
            playbook: playbook
              ? {
                  commonPains: playbook.commonPains,
                  offerAngles: playbook.offerAngles,
                  messagingFocus: playbook.messagingFocus,
                }
              : null,
            reviewSignals,
          },
        );

        businessContext = combined.business_context;
        painHypothesis = combined.pain_hypothesis;

        // Persist both results
        try {
          await persistBusinessContext(companyWithEvidence.id, businessContext);
          stages.push({ stage: "business-context", status: JobStatus.SUCCEEDED });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Business context persistence failed.";
          stages.push({ stage: "business-context", status: JobStatus.FAILED, error: message });
          // Non-fatal — business context was still extracted for downstream use
        }

        await persistPainHypothesis(companyId, painHypothesis);
        stages.push({
          stage: "pain-hypothesis",
          status: painHypothesis.insufficient_evidence ? JobStatus.PARTIAL : JobStatus.SUCCEEDED,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Business context and pain hypothesis generation failed.";
        await persistPipelineStageOutcome({
          companyId,
          provider: SourceProvider.OPENAI,
          stage: EnrichmentStage.PAIN_HYPOTHESIS_GENERATION,
          status: JobStatus.FAILED,
          error: message,
        });
        stages.push({
          stage: "business-context",
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
    }

    let llmScore: Awaited<ReturnType<typeof generateLeadScore>>;

    const existingLeadScore = await db.leadScore.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    if (existingLeadScore?.rawPayload && "sub_scores" in (existingLeadScore.rawPayload as object)) {
      llmScore = existingLeadScore.rawPayload as Awaited<ReturnType<typeof generateLeadScore>>;
      stages.push({ stage: "score", status: JobStatus.SUCCEEDED, skipped: true });
    } else {
      try {
        llmScore = await generateLeadScore({
          companyName: companyWithEvidence.name,
          website: companyWithEvidence.website,
          industry: companyWithEvidence.industry,
          employeeCount: companyWithEvidence.employeeCount,
          description: companyWithEvidence.description,
          contacts: companyWithEvidence.contacts.map((c) => ({
            fullName: c.fullName,
            title: c.title,
            email: c.email,
            phone: c.phone,
            seniority: c.seniority,
            decisionMakerConfidence: c.decisionMakerConfidence,
          })),
          painHypothesis: {
            primary_pain: painHypothesis.primary_pain,
            confidence_score: painHypothesis.confidence_score,
            business_impact: painHypothesis.business_impact,
            company_summary: painHypothesis.company_summary,
            observed_signals: painHypothesis.observed_signals,
            best_outreach_angle: painHypothesis.best_outreach_angle,
            insufficient_evidence: painHypothesis.insufficient_evidence,
          },
          businessContext: businessContext
            ? {
                website_summary: businessContext.website_summary,
                services_offerings: businessContext.services_offerings,
                customer_type: businessContext.customer_type,
                urgency_signals: businessContext.urgency_signals,
                weak_lead_capture_signals: businessContext.weak_lead_capture_signals,
              }
            : null,
          playbook: playbook
            ? {
                commonPains: playbook.commonPains,
                messagingFocus: playbook.messagingFocus,
              }
            : null,
        });
        // Resolve recommended contact
        const recommendedContact =
          companyWithEvidence.contacts[llmScore.recommended_primary_contact_index] ??
          companyWithEvidence.contacts[0];
        await persistLeadScore(companyId, llmScore, recommendedContact?.id);
        stages.push({ stage: "score", status: JobStatus.SUCCEEDED });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lead scoring failed.";
        await persistPipelineStageOutcome({
          companyId,
          provider: SourceProvider.OPENAI,
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
    }

    let leadMagnet: Awaited<ReturnType<typeof buildLeadMagnet>>;
    let persistedLeadMagnet: Awaited<ReturnType<typeof persistLeadMagnet>>;

    const existingLeadMagnet = await db.leadMagnet.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    if (existingLeadMagnet) {
      persistedLeadMagnet = existingLeadMagnet;
      leadMagnet = existingLeadMagnet.rawPayload
        ? (existingLeadMagnet.rawPayload as Awaited<ReturnType<typeof buildLeadMagnet>>)
        : {
            title: existingLeadMagnet.title,
            type: existingLeadMagnet.type,
            summary: existingLeadMagnet.summary,
            why_it_matches_the_lead: existingLeadMagnet.whyItMatchesTheLead,
            suggested_delivery_format: existingLeadMagnet.suggestedDeliveryFormat,
            estimated_time_to_prepare: existingLeadMagnet.estimatedTimeToPrepare,
            suggested_outreach_mention: existingLeadMagnet.suggestedOutreachMention ?? "",
            content_body: existingLeadMagnet.contentBody ?? "",
          };
      stages.push({ stage: "lead-magnet", status: JobStatus.SUCCEEDED, skipped: true });
    } else {
      try {
        leadMagnet = await buildLeadMagnet(
          {
            companyName: companyWithEvidence.name,
            industry: companyWithEvidence.industry,
            primaryPain: painHypothesis.primary_pain,
            recommendedLeadMagnetType: painHypothesis.recommended_lead_magnet_type,
            recommendedServiceAngle: painHypothesis.recommended_service_angle,
            insufficientEvidence: painHypothesis.insufficient_evidence,
          },
          {
            playbook: playbook
              ? {
                  preferredLeadMagnetTypes: playbook.preferredLeadMagnetTypes,
                  offerAngles: playbook.offerAngles,
                  messagingFocus: playbook.messagingFocus,
                }
              : null,
          },
        );
        persistedLeadMagnet = await persistLeadMagnet(companyId, leadMagnet);
        stages.push({ stage: "lead-magnet", status: JobStatus.SUCCEEDED });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lead magnet generation failed.";
        await persistPipelineStageOutcome({
          companyId,
          provider: SourceProvider.OPENAI,
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
    }

    let diagnosticForm: ReturnType<typeof buildDiagnosticFormBlueprint>;
    let persistedDiagnosticForm: Awaited<ReturnType<typeof persistDiagnosticFormBlueprint>>;
    const persistedPain = await db.painHypothesis.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const existingDiagnosticForm = await db.diagnosticFormBlueprint.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { formLink: true },
    });

    let diagnosticFormUrl: string | null = null;

    if (existingDiagnosticForm) {
      persistedDiagnosticForm = existingDiagnosticForm;
      diagnosticForm = existingDiagnosticForm.rawPayload
        ? (existingDiagnosticForm.rawPayload as ReturnType<typeof buildDiagnosticFormBlueprint>)
        : buildDiagnosticFormBlueprint({
            companyName: companyWithEvidence.name,
            industry: companyWithEvidence.industry,
            primaryPain: painHypothesis.primary_pain,
            serviceAngle: painHypothesis.recommended_service_angle,
          });

      diagnosticFormUrl = existingDiagnosticForm.formLink?.url ?? null;
      let diagnosticFormStatus: JobStatus = JobStatus.SUCCEEDED;
      let diagnosticFormError: string | undefined;

      // Create live form link only if one doesn't already exist
      if (!existingDiagnosticForm.formLink) {
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
      }

      stages.push({
        stage: "diagnostic-form",
        status: diagnosticFormStatus,
        error: diagnosticFormError,
        skipped: true,
      });
    } else {
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
    }

    const contacts = companyWithEvidence.contacts.filter(
      (contact) => Boolean(contact.email) || Boolean(contact.phone),
    );

    if (contacts.length === 0) {
      const noContactsReason =
        apolloWarnings[0] ?? "No valid contacts with email or phone were available for draft generation.";

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

      // Idempotency: skip outreach generation if a draft already exists for this contact
      const existingDraftForContact = companyWithEvidence.outreachDrafts.find(
        (d) => d.contactId === contact.id && d.draftType === "INITIAL",
      );
      if (existingDraftForContact) {
        campaignDrafts.push({
          id: existingDraftForContact.id,
          companyId: companyWithEvidence.id,
          approvalStatus: existingDraftForContact.approvalStatus,
          gmailSyncStatus: existingDraftForContact.gmailDraftLink?.syncStatus ?? ExternalSyncStatus.NOT_READY,
          suppressionReason: null,
        });
        continue;
      }

      const llmOutreach = await generateOutreachDraft({
        companyName: companyWithEvidence.name,
        contactName: contact.firstName ?? contact.fullName,
        contactTitle: contact.title,
        painHypothesis: {
          primary_pain: painHypothesis.primary_pain,
          company_summary: painHypothesis.company_summary,
          best_outreach_angle: painHypothesis.best_outreach_angle,
          confidence_score: painHypothesis.confidence_score,
          caution_do_not_claim: painHypothesis.caution_do_not_claim,
        },
        leadMagnet: {
          title: leadMagnet.title,
          type: leadMagnet.type,
          suggested_outreach_mention: leadMagnet.suggested_outreach_mention,
        },
        businessContext: businessContext
          ? {
              website_summary: businessContext.website_summary,
              services_offerings: businessContext.services_offerings,
              customer_type: businessContext.customer_type,
            }
          : null,
        leadScore: {
          total_score: llmScore.total_score,
          recommended_action: llmScore.recommended_action,
          recommended_channel: llmScore.recommended_channel,
        },
        playbook: playbook
          ? {
              messagingFocus: playbook.messagingFocus,
              ctaPreferences: playbook.ctaPreferences,
              toneGuidance: playbook.toneGuidance,
              doNotMention: playbook.doNotMention,
            }
          : null,
        diagnosticFormCta: diagnosticForm
          ? {
              mode: "lead_magnet_and_form",
              short: diagnosticForm.outreach_cta_short,
              medium: diagnosticForm.outreach_cta_medium,
            }
          : null,
      });
      let outreach = mapLlmOutreachToOutreachSchema(llmOutreach);

      // QA check
      let qaResult: Awaited<ReturnType<typeof runQaCheck>> | null = null;
      try {
        qaResult = await runQaCheck({
          outreachDraft: {
            emailSubject1: outreach.email_subject_1,
            emailSubject2: outreach.email_subject_2,
            coldEmailShort: outreach.cold_email_short,
            coldEmailMedium: outreach.cold_email_medium,
            linkedinMessageSafe: outreach.linkedin_message_safe,
            followUp1: outreach.follow_up_1,
            followUp2: outreach.follow_up_2,
          },
          companyName: companyWithEvidence.name,
          contactName: contact.firstName ?? contact.fullName,
          painHypothesis: {
            primary_pain: painHypothesis.primary_pain,
            company_summary: painHypothesis.company_summary,
            confidence_score: painHypothesis.confidence_score,
            caution_do_not_claim: painHypothesis.caution_do_not_claim,
          },
          businessContext: businessContext
            ? {
                website_summary: businessContext.website_summary,
                services_offerings: businessContext.services_offerings,
              }
            : null,
        });

        // Apply QA revisions if there are blockers with fixes
        if (qaResult && !qaResult.passed && Object.keys(qaResult.revised_fields).length > 0) {
          const revised = qaResult.revised_fields;
          if (revised.cold_email_medium) outreach = { ...outreach, cold_email_medium: revised.cold_email_medium };
          if (revised.cold_email_short) outreach = { ...outreach, cold_email_short: revised.cold_email_short };
          if (revised.linkedin_message_safe) outreach = { ...outreach, linkedin_message_safe: revised.linkedin_message_safe };
          if (revised.email_subject_1) outreach = { ...outreach, email_subject_1: revised.email_subject_1 };
          if (revised.email_subject_2) outreach = { ...outreach, email_subject_2: revised.email_subject_2 };
          if (revised.follow_up_1) outreach = { ...outreach, follow_up_1: revised.follow_up_1 };
          if (revised.follow_up_2) outreach = { ...outreach, follow_up_2: revised.follow_up_2 };
        }
      } catch (error) {
        // QA is advisory — don't block pipeline
        console.warn("[full-pipeline] Non-fatal: QA check failed for contact", contact.id, ":", error);
      }

      const persistedDraft = await persistOutreachDraft({
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

      // Persist QA result (non-fatal)
      if (qaResult) {
        try {
          await persistQaCheckResult(persistedDraft.id, qaResult);
        } catch (error) {
          console.warn("[full-pipeline] Non-fatal: Failed to persist QA check result for draft", persistedDraft.id, ":", error);
        }
      }

      // Create follow-up sequence skeletons
      try {
        await createFollowUpSkeletons(
          {
            id: persistedDraft.id,
            companyId,
            contactId: contact.id,
            createdAt: new Date(),
          },
          db,
        );
      } catch (error) {
        console.warn("[full-pipeline] Non-fatal: Failed to create follow-up skeletons for draft", persistedDraft.id, ":", error);
      }

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
  } finally {
    // Release the concurrency lock — set status to READY (or keep ARCHIVED).
    try {
      await db.company.updateMany({
        where: { id: companyId, status: CompanyStatus.ENRICHING },
        data: { status: CompanyStatus.READY },
      });
    } catch (unlockError) {
      console.error("[full-pipeline] Failed to release pipeline lock:", unlockError);
    }
  }
}
