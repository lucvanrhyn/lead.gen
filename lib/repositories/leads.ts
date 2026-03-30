import { ApprovalStatus, EnrichmentStage, ExternalSyncStatus, JobStatus } from "@prisma/client";
import { buildCampaignAnalytics } from "@/lib/ai/outreach";
import { db } from "@/lib/db";
import {
  deriveGoogleWorkspaceState,
  getGoogleWorkspaceEnvState,
  getGoogleWorkspaceStatusCopy,
} from "@/lib/domain/google-workspace";
import { deriveApprovalQueueSummary } from "@/lib/domain/outreach-ops";
import {
  type ApprovalQueueItem,
  type ApprovalQueueSummary,
  type CampaignAnalytics,
  type LeadTablePagination,
  type GoogleWorkspaceStatusViewModel,
  type LeadDetailViewModel,
  type LeadPipelineStageStatus,
  type LeadPipelineStageViewModel,
  type LeadPipelineViewModel,
  type LeadTableRow,
} from "@/lib/leads/view-models";

function formatConfidence(value: number | null | undefined) {
  return value == null ? "--" : value.toFixed(2);
}

function formatScore(value: number | null | undefined) {
  return value == null ? "Unscored" : `${value} / 100`;
}

function formatDateTime(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function deriveDisplayedCompanyStatus(input: {
  status: string;
  manualReviewRequired: boolean;
  hasRecentPipelineOutput: boolean;
  hasRunningJob?: boolean;
}) {
  if (input.manualReviewRequired) {
    return "NEEDS_REVIEW";
  }

  if (input.hasRunningJob) {
    return "ENRICHING";
  }

  if (input.hasRecentPipelineOutput) {
    return "READY";
  }

  return input.status;
}

function mapPipelineJobStatus(status: JobStatus): LeadPipelineStageStatus {
  switch (status) {
    case JobStatus.PENDING:
    case JobStatus.RUNNING:
      return "RUNNING";
    case JobStatus.SUCCEEDED:
      return "SUCCEEDED";
    case JobStatus.PARTIAL:
      return "PARTIAL";
    case JobStatus.FAILED:
      return "FAILED";
    default:
      return "NOT_STARTED";
  }
}

function readStageSummaryNote(job?: {
  lastError?: string | null;
  resultSummary?: unknown;
}) {
  if (job?.lastError) {
    return job.lastError;
  }

  const summary = toRecord(job?.resultSummary);

  if (!summary) {
    return undefined;
  }

  if (typeof summary.note === "string") {
    return summary.note;
  }

  if (
    typeof summary.generatedDraftCount === "number" &&
    typeof summary.suppressedContactCount === "number"
  ) {
    return `${summary.generatedDraftCount} draft${summary.generatedDraftCount === 1 ? "" : "s"} generated, ${summary.suppressedContactCount} contact${summary.suppressedContactCount === 1 ? "" : "s"} suppressed.`;
  }

  if (typeof summary.contact_count === "number") {
    return `${summary.contact_count} contact${summary.contact_count === 1 ? "" : "s"} returned.`;
  }

  if (typeof summary.page_count === "number") {
    return `${summary.page_count} page${summary.page_count === 1 ? "" : "s"} extracted.`;
  }

  return undefined;
}

function buildLeadPipeline(company: {
  website: string | null;
  normalizedDomain?: string | null;
  contacts: Array<{ email: string | null }>;
  crawlPages: Array<{ id: string }>;
  painHypotheses: Array<{ insufficientEvidence?: boolean | null }>;
  leadScores: Array<{ id: string }>;
  leadMagnets: Array<{ id: string }>;
  diagnosticForms: Array<{ id: string; formLink?: { url: string | null } | null }>;
  outreachDrafts: Array<{ id: string }>;
  enrichmentJobs: Array<{
    stage: EnrichmentStage;
    status: JobStatus;
    lastError: string | null;
    resultSummary: unknown;
    updatedAt: Date;
  }>;
}): LeadPipelineViewModel {
  const latestJobByStage = new Map<EnrichmentStage, (typeof company.enrichmentJobs)[number]>();

  for (const job of company.enrichmentJobs) {
    if (!latestJobByStage.has(job.stage)) {
      latestJobByStage.set(job.stage, job);
    }
  }

  const contactEmailCount = company.contacts.filter((contact) => Boolean(contact.email)).length;
  const hasPain = company.painHypotheses.length > 0;
  const latestPain = company.painHypotheses[0];
  const hasLeadMagnet = company.leadMagnets.length > 0;
  const latestDiagnosticForm = company.diagnosticForms[0];
  const enrichJob =
    latestJobByStage.get(EnrichmentStage.APOLLO_PEOPLE_ENRICHMENT) ??
    latestJobByStage.get(EnrichmentStage.APOLLO_COMPANY_ENRICHMENT);
  const crawlJob = latestJobByStage.get(EnrichmentStage.FIRECRAWL_EXTRACTION);
  const painJob = latestJobByStage.get(EnrichmentStage.PAIN_HYPOTHESIS_GENERATION);
  const scoreJob = latestJobByStage.get(EnrichmentStage.LEAD_SCORING);
  const leadMagnetJob = latestJobByStage.get(EnrichmentStage.LEAD_MAGNET_GENERATION);
  const outreachJob = latestJobByStage.get(EnrichmentStage.OUTREACH_GENERATION);

  const stages: LeadPipelineStageViewModel[] = [
    {
      id: "enrich",
      label: "Apollo enrich",
      status: enrichJob
        ? mapPipelineJobStatus(enrichJob.status)
        : company.normalizedDomain || company.contacts.length > 0
          ? "SUCCEEDED"
          : company.website
            ? "NOT_STARTED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(enrichJob) ??
        (contactEmailCount > 0
          ? `${contactEmailCount} contact${contactEmailCount === 1 ? "" : "s"} with email available.`
          : company.contacts.length > 0
            ? `${company.contacts.length} contact${company.contacts.length === 1 ? "" : "s"} found, but none have email addresses yet.`
            : company.website || company.normalizedDomain
              ? "Ready to enrich this company from Apollo."
              : "Add a public website or domain before Apollo enrichment can run."),
      updatedAtLabel: enrichJob ? formatDateTime(enrichJob.updatedAt) : undefined,
    },
    {
      id: "crawl",
      label: "Extract site",
      status: crawlJob
        ? mapPipelineJobStatus(crawlJob.status)
        : company.crawlPages.length > 0
          ? "SUCCEEDED"
          : company.website
            ? "NOT_STARTED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(crawlJob) ??
        (company.crawlPages.length > 0
          ? `${company.crawlPages.length} page${company.crawlPages.length === 1 ? "" : "s"} extracted from the website.`
          : company.website
            ? "Website extraction has not run yet."
            : "A public website is required before site extraction can run."),
      updatedAtLabel: crawlJob ? formatDateTime(crawlJob.updatedAt) : undefined,
    },
    {
      id: "pain",
      label: "Generate pains",
      status: painJob
        ? mapPipelineJobStatus(painJob.status)
        : hasPain
          ? latestPain?.insufficientEvidence
            ? "PARTIAL"
            : "SUCCEEDED"
          : company.crawlPages.length > 0
            ? "NOT_STARTED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(painJob) ??
        (hasPain
          ? latestPain?.insufficientEvidence
            ? "Pain hypothesis saved, but the public evidence is still thin."
            : "Pain hypothesis generated from the current evidence."
          : company.crawlPages.length > 0
            ? "Pain generation has not run yet."
            : "Run site extraction or add more public evidence before generating pains."),
      updatedAtLabel: painJob ? formatDateTime(painJob.updatedAt) : undefined,
    },
    {
      id: "score",
      label: "Score lead",
      status: scoreJob
        ? mapPipelineJobStatus(scoreJob.status)
        : company.leadScores.length > 0
          ? "SUCCEEDED"
          : hasPain
            ? "NOT_STARTED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(scoreJob) ??
        (company.leadScores.length > 0
          ? "Lead score saved."
          : hasPain
            ? "Lead scoring has not run yet."
            : "Generate a pain hypothesis before scoring the lead."),
      updatedAtLabel: scoreJob ? formatDateTime(scoreJob.updatedAt) : undefined,
    },
    {
      id: "magnet",
      label: "Create lead magnet",
      status: leadMagnetJob
        ? mapPipelineJobStatus(leadMagnetJob.status)
        : hasLeadMagnet
          ? "SUCCEEDED"
          : hasPain
            ? "NOT_STARTED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(leadMagnetJob) ??
        (hasLeadMagnet
          ? "Lead magnet created."
          : hasPain
            ? "Lead magnet generation has not run yet."
            : "Generate a pain hypothesis before creating a lead magnet."),
      updatedAtLabel: leadMagnetJob ? formatDateTime(leadMagnetJob.updatedAt) : undefined,
    },
    {
      id: "form",
      label: "Generate form",
      status: latestDiagnosticForm
        ? latestDiagnosticForm.formLink?.url
          ? "SUCCEEDED"
          : "PARTIAL"
        : hasPain
          ? "NOT_STARTED"
          : "BLOCKED",
      detail: latestDiagnosticForm
        ? latestDiagnosticForm.formLink?.url
          ? "Diagnostic blueprint saved and a live Google Form is attached."
          : "Diagnostic blueprint saved. Connect Google Workspace to create a live Google Form."
        : hasPain
          ? "Diagnostic form generation has not run yet."
          : "Generate a pain hypothesis before creating a diagnostic form.",
    },
    {
      id: "outreach",
      label: "Draft outreach",
      status: outreachJob
        ? mapPipelineJobStatus(outreachJob.status)
        : company.outreachDrafts.length > 0
          ? "SUCCEEDED"
          : hasLeadMagnet
            ? contactEmailCount > 0
              ? "NOT_STARTED"
              : "BLOCKED"
            : "BLOCKED",
      detail:
        readStageSummaryNote(outreachJob) ??
        (company.outreachDrafts.length > 0
          ? `${company.outreachDrafts.length} outreach draft${company.outreachDrafts.length === 1 ? "" : "s"} generated.`
          : contactEmailCount > 0
            ? "Outreach generation has not run yet."
            : "No valid contacts with email were available for outreach drafts."),
      updatedAtLabel: outreachJob ? formatDateTime(outreachJob.updatedAt) : undefined,
    },
  ];

  return {
    completedCount: stages.filter((stage) => stage.status === "SUCCEEDED" || stage.status === "PARTIAL").length,
    totalCount: stages.length,
    stages,
  };
}

export async function getLeadSummaries(input?: {
  page?: number;
  pageSize?: number;
}): Promise<{
  leads: LeadTableRow[];
  pagination: LeadTablePagination;
}> {
  const requestedPage = Math.max(1, input?.page ?? 1);
  const pageSize = Math.max(1, Math.min(input?.pageSize ?? 10, 50));

  try {
    const totalCount = await db.company.count();
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const companies = await db.company.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contacts: {
          select: { id: true },
        },
        leadScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        painHypotheses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return {
      leads: companies.map((company) => ({
        id: company.id,
        name: company.name,
        website: company.website ?? undefined,
        industry: company.industry ?? undefined,
        locationSummary: company.locationSummary ?? undefined,
        score: company.leadScores[0]?.totalScore,
        scoreLabel: formatScore(company.leadScores[0]?.totalScore),
        painConfidence: company.painHypotheses[0]?.confidenceScore ?? undefined,
        sourceConfidence: company.sourceConfidence ?? undefined,
        contactsCount: company.contacts.length,
        manualReviewRequired: company.manualReviewRequired,
        status: deriveDisplayedCompanyStatus({
          status: company.status,
          manualReviewRequired: company.manualReviewRequired,
          hasRecentPipelineOutput: Boolean(
            company.leadScores[0] || company.painHypotheses[0] || company.outreachDrafts[0],
          ),
        }),
        approvalStatus: company.outreachDrafts[0]?.approvalStatus,
      })),
      pagination: {
        page,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  } catch {
    return {
      leads: [],
      pagination: {
        page: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    };
  }
}

export async function getApprovalQueue(): Promise<{
  summary: ApprovalQueueSummary;
  items: ApprovalQueueItem[];
  campaignAnalytics: CampaignAnalytics;
}> {
  try {
    const [drafts, engagementEvents, outreachJobs] = await Promise.all([
      db.outreachDraft.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          contact: {
            select: {
              fullName: true,
            },
          },
          gmailDraftLink: true,
          sheetSyncRecords: {
            where: { tabName: "Drafts" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.outreachEngagementEvent.findMany({
        select: {
          id: true,
          outreachDraftId: true,
          eventType: true,
        },
      }),
      db.enrichmentJob.findMany({
        where: { stage: "OUTREACH_GENERATION" },
        orderBy: { createdAt: "desc" },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const items: ApprovalQueueItem[] = drafts.map((draft) => ({
      draftId: draft.id,
      leadId: draft.company.id,
      companyName: draft.company.name,
      contactName: draft.contact?.fullName ?? undefined,
      emailSubject: draft.emailSubject1,
      approvalStatus: draft.approvalStatus,
      gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? "NOT_READY",
      sheetSyncStatus: draft.sheetSyncRecords[0]?.syncStatus ?? "NOT_READY",
    }));
    const latestJobByCompany = new Map<string, (typeof outreachJobs)[number]>();

    for (const job of outreachJobs) {
      if (!job.companyId || latestJobByCompany.has(job.companyId)) {
        continue;
      }

      latestJobByCompany.set(job.companyId, job);
    }

    for (const job of latestJobByCompany.values()) {
      if (!job.company) {
        continue;
      }

      const summary = toRecord(job.resultSummary);
      const suppressedContacts = Array.isArray(summary?.suppressedContacts)
        ? summary.suppressedContacts
        : [];

      for (const [index, suppressedContact] of suppressedContacts.entries()) {
        const contact = toRecord(suppressedContact);

        items.push({
          draftId: `suppressed:${job.company.id}:${contact?.contactId ?? index}`,
          leadId: job.company.id,
          companyName: job.company.name,
          contactName:
            typeof contact?.contactName === "string" ? contact.contactName : undefined,
          emailSubject: "Suppressed outreach",
          approvalStatus: "SUPPRESSED",
          gmailSyncStatus: "NOT_READY",
          sheetSyncStatus: "NOT_READY",
          suppressionReason:
            typeof contact?.reason === "string" ? contact.reason : "suppressed",
        });
      }
    }

    const campaignAnalytics = buildCampaignAnalytics({
      drafts: items.map((item) => ({
        id: item.draftId,
        companyId: item.leadId,
        approvalStatus:
          item.approvalStatus === "SUPPRESSED"
            ? ApprovalStatus.PENDING_APPROVAL
            : (item.approvalStatus as ApprovalStatus),
        gmailSyncStatus: item.gmailSyncStatus as ExternalSyncStatus,
        suppressionReason: toSuppressionReason(item.suppressionReason),
      })),
      engagementEvents,
    });

    return {
      summary: deriveApprovalQueueSummary(
        items
          .filter((item) => item.approvalStatus !== "SUPPRESSED")
          .map((item) => ({
          approvalStatus:
            item.approvalStatus === "SUPPRESSED"
              ? ApprovalStatus.PENDING_APPROVAL
              : (item.approvalStatus as ApprovalStatus),
          gmailSyncStatus: item.gmailSyncStatus as ExternalSyncStatus,
          sheetSyncStatus: item.sheetSyncStatus as ExternalSyncStatus,
          })),
      ),
      items,
      campaignAnalytics,
    };
  } catch {
    return {
      summary: {
        pendingApprovalCount: 0,
        approvedCount: 0,
        syncedDraftCount: 0,
      },
      items: [],
      campaignAnalytics: {
        sentCount: 0,
        viewedCount: 0,
        repliedCount: 0,
        followUpDueCount: 0,
        suppressedCount: 0,
      },
    };
  }
}

export async function getGoogleWorkspaceStatus(): Promise<GoogleWorkspaceStatusViewModel> {
  try {
    const connection = await db.googleWorkspaceConnection.findUnique({
      where: { provider: "google_workspace" },
      select: {
        status: true,
        email: true,
        scopes: true,
        lastError: true,
        gmailWatchStatus: true,
        gmailWatchExpiresAt: true,
        gmailWatchLastNotificationAt: true,
        gmailWatchLastError: true,
      },
    });

    const state = deriveGoogleWorkspaceState({
      ...getGoogleWorkspaceEnvState(),
      connection,
    });
    const copy = getGoogleWorkspaceStatusCopy(state.status);

    return {
      ...state,
      ...copy,
      lastError: connection?.lastError ?? undefined,
      gmailWatchStatus: connection?.gmailWatchStatus ?? "NOT_READY",
      gmailWatchExpiresAtLabel: connection?.gmailWatchExpiresAt
        ? formatDateTime(connection.gmailWatchExpiresAt)
        : undefined,
      gmailWatchLastNotificationAtLabel: connection?.gmailWatchLastNotificationAt
        ? formatDateTime(connection.gmailWatchLastNotificationAt)
        : undefined,
      gmailWatchLastError: connection?.gmailWatchLastError ?? undefined,
      canRegisterGmailWatch:
        state.status === "CONNECTED" && Boolean(process.env.GOOGLE_GMAIL_PUBSUB_TOPIC),
    };
  } catch {
    const state = deriveGoogleWorkspaceState({
      ...getGoogleWorkspaceEnvState(),
      connection: null,
    });
    const copy = getGoogleWorkspaceStatusCopy(state.status);

    return {
      ...state,
      ...copy,
      lastError: undefined,
      gmailWatchStatus: "NOT_READY",
      canRegisterGmailWatch: false,
    };
  }
}

export async function getLeadDetail(id: string): Promise<LeadDetailViewModel | null> {
  try {
    const company = await db.company.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: { decisionMakerConfidence: "desc" },
        },
        technologyProfiles: {
          orderBy: { confidence: "desc" },
        },
        crawlPages: {
          orderBy: { extractedAt: "desc" },
        },
        newsMentions: {
          orderBy: { publishedAt: "desc" },
        },
        painHypotheses: {
          orderBy: { createdAt: "desc" },
        },
        leadScores: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        leadMagnets: {
          orderBy: { createdAt: "desc" },
        },
        leadMagnetAssets: {
          orderBy: { createdAt: "desc" },
        },
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
          include: {
            contact: {
              select: {
                email: true,
              },
            },
            gmailDraftLink: true,
            leadMagnetAsset: true,
            sheetSyncRecords: {
              where: { tabName: "Drafts" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        engagementEvents: {
          orderBy: { occurredAt: "desc" },
        },
        linkedinTasks: {
          orderBy: { createdAt: "desc" },
        },
        diagnosticForms: {
          orderBy: { createdAt: "desc" },
          include: {
            formLink: true,
          },
        },
        enrichmentJobs: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!company) {
      return null;
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        website: company.website ?? undefined,
        industry: company.industry ?? undefined,
        locationSummary: company.locationSummary ?? undefined,
        phone: company.phone ?? undefined,
        description: company.description ?? undefined,
        scoreLabel: formatScore(company.leadScores[0]?.totalScore),
        sourceConfidenceLabel: formatConfidence(company.sourceConfidence),
        manualReviewRequired: company.manualReviewRequired,
        status: deriveDisplayedCompanyStatus({
          status: company.status,
          manualReviewRequired: company.manualReviewRequired,
          hasRecentPipelineOutput: Boolean(
            company.leadScores[0] ||
              company.painHypotheses[0] ||
              company.leadMagnets[0] ||
              company.diagnosticForms[0] ||
              company.outreachDrafts[0],
          ),
          hasRunningJob: company.enrichmentJobs.some(
            (job) => job.status === JobStatus.PENDING || job.status === JobStatus.RUNNING,
          ),
        }),
        hasWebsite: Boolean(company.website),
      },
      pipeline: buildLeadPipeline(company),
      contacts: company.contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        title: contact.title ?? undefined,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        confidenceLabel: formatConfidence(contact.decisionMakerConfidence),
      })),
      technologies: company.technologyProfiles.map((profile) => ({
        id: profile.id,
        name: profile.technologyName,
        category: profile.category ?? undefined,
        confidenceLabel: formatConfidence(profile.confidence),
      })),
      newsMentions: company.newsMentions.map((mention) => ({
        id: mention.id,
        title: mention.title,
        sourceName: mention.sourceName ?? undefined,
        articleUrl: mention.articleUrl,
      })),
      painHypotheses: company.painHypotheses.map((pain) => ({
        id: pain.id,
        primaryPain: pain.primaryPain,
        confidenceLabel: formatConfidence(pain.confidenceScore),
        businessImpact: pain.businessImpact,
        recommendedServiceAngle: pain.recommendedServiceAngle,
      })),
      leadMagnets: company.leadMagnets.map((leadMagnet) => ({
        id: leadMagnet.id,
        title: leadMagnet.title,
        type: leadMagnet.type,
        summary: leadMagnet.summary,
        whyItMatchesTheLead: leadMagnet.whyItMatchesTheLead,
        suggestedDeliveryFormat: leadMagnet.suggestedDeliveryFormat,
      })),
      leadMagnetAssets: company.leadMagnetAssets.map((asset) => ({
        id: asset.id,
        slug: asset.slug,
        assetPath: `/assets/${asset.slug}`,
        headline: asset.headline,
        intro: asset.intro,
        status: asset.status,
        viewCount: asset.viewCount,
        firstViewedAtLabel: asset.firstViewedAt ? formatDateTime(asset.firstViewedAt) : undefined,
        lastViewedAtLabel: asset.lastViewedAt ? formatDateTime(asset.lastViewedAt) : undefined,
        followUpCreatedAtLabel: asset.followUpCreatedAt
          ? formatDateTime(asset.followUpCreatedAt)
          : undefined,
        diagnosticFormUrl: asset.diagnosticFormUrl ?? undefined,
      })),
      outreachDrafts: company.outreachDrafts.map((draft) => ({
        id: draft.id,
        emailSubject1: draft.emailSubject1,
        emailSubject2: draft.emailSubject2,
        coldEmailShort: draft.coldEmailShort,
        coldEmailMedium: draft.coldEmailMedium,
        followUp1: draft.followUp1,
        draftType: draft.draftType,
        sequenceStep: draft.sequenceStep,
        approvalStatus: draft.approvalStatus,
        gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? "NOT_READY",
        gmailThreadId: draft.gmailDraftLink?.gmailThreadId ?? undefined,
        sheetSyncStatus: draft.sheetSyncRecords[0]?.syncStatus ?? "NOT_READY",
        assetPath: draft.leadMagnetAsset?.slug
          ? `/assets/${draft.leadMagnetAsset.slug}`
          : undefined,
        diagnosticFormUrl: draft.leadMagnetAsset?.diagnosticFormUrl ?? undefined,
        contactEmail: draft.contact?.email ?? undefined,
      })),
      engagementEvents: company.engagementEvents.map((event) => ({
        id: event.id,
        draftId: event.outreachDraftId,
        eventType: event.eventType,
        followUpCreated: event.followUpCreated,
        occurredAtLabel: formatDateTime(event.occurredAt),
      })),
      linkedinTasks: company.linkedinTasks.map((task) => ({
        id: task.id,
        contactName: task.contactName ?? undefined,
        contactTitle: task.contactTitle ?? undefined,
        lookupStatus: task.status,
        profileUrl: task.linkedinProfileUrl ?? undefined,
        connectionRequestNote: task.connectionRequestNote,
        dmMessage: task.dmMessage,
        followUpDm: task.followUpDm,
      })),
      diagnosticForms: company.diagnosticForms.map((form) => ({
        id: form.id,
        formTitle: form.formTitle,
        estimatedCompletionTime: form.estimatedCompletionTime,
        industry: form.industry,
        outreachCtaShort: form.outreachCtaShort,
        googleFormUrl: form.formLink?.url ?? undefined,
        responseStatus: form.formLink?.responseStatus ?? "NOT_SHARED",
        responseSummary: (form.formLink?.responseSummary as Record<string, unknown> | null) ?? undefined,
      })),
    };
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toSuppressionReason(value: string | null | undefined) {
  switch (value) {
    case "duplicate_contact":
    case "company_cooldown":
    case "active_engagement":
      return value;
    default:
      return null;
  }
}
