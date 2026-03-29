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
  type GoogleWorkspaceStatusViewModel,
  type LeadDetailViewModel,
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

export async function getLeadSummaries(): Promise<LeadTableRow[]> {
  try {
    const companies = await db.company.findMany({
      orderBy: {
        updatedAt: "desc",
      },
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

    return companies.map((company) => ({
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
      status: company.status,
      approvalStatus: company.outreachDrafts[0]?.approvalStatus,
    }));
  } catch {
    return [];
  }
}

export async function getApprovalQueue(): Promise<{
  summary: ApprovalQueueSummary;
  items: ApprovalQueueItem[];
}> {
  try {
    const drafts = await db.outreachDraft.findMany({
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
    });

    const items = drafts.map((draft) => ({
      draftId: draft.id,
      leadId: draft.company.id,
      companyName: draft.company.name,
      contactName: draft.contact?.fullName ?? undefined,
      emailSubject: draft.emailSubject1,
      approvalStatus: draft.approvalStatus,
      gmailSyncStatus: draft.gmailDraftLink?.syncStatus ?? "NOT_READY",
      sheetSyncStatus: draft.sheetSyncRecords[0]?.syncStatus ?? "NOT_READY",
    }));

    return {
      summary: deriveApprovalQueueSummary(
        items.map((item) => ({
          approvalStatus: item.approvalStatus,
          gmailSyncStatus: item.gmailSyncStatus,
          sheetSyncStatus: item.sheetSyncStatus,
        })),
      ),
      items,
    };
  } catch {
    return {
      summary: {
        pendingApprovalCount: 0,
        approvedCount: 0,
        syncedDraftCount: 0,
      },
      items: [],
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
        status: company.status,
        hasWebsite: Boolean(company.website),
      },
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
        sheetSyncStatus: draft.sheetSyncRecords[0]?.syncStatus ?? "NOT_READY",
        assetPath: draft.leadMagnetAsset?.slug
          ? `/assets/${draft.leadMagnetAsset.slug}`
          : undefined,
        diagnosticFormUrl: draft.leadMagnetAsset?.diagnosticFormUrl ?? undefined,
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
      })),
    };
  } catch {
    return null;
  }
}
