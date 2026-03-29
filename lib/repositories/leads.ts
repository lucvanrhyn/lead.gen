import { db } from "@/lib/db";
import { type LeadDetailViewModel, type LeadTableRow } from "@/lib/leads/view-models";

function formatConfidence(value: number | null | undefined) {
  return value == null ? "--" : value.toFixed(2);
}

function formatScore(value: number | null | undefined) {
  return value == null ? "Unscored" : `${value} / 100`;
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
    }));
  } catch {
    return [];
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
        outreachDrafts: {
          orderBy: { createdAt: "desc" },
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
      outreachDrafts: company.outreachDrafts.map((draft) => ({
        id: draft.id,
        emailSubject1: draft.emailSubject1,
        coldEmailShort: draft.coldEmailShort,
      })),
    };
  } catch {
    return null;
  }
}
