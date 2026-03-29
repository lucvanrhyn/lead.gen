import { JobStatus } from "@prisma/client";

import { buildDiagnosticFormBlueprint, persistDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";
import { buildLeadMagnet, persistLeadMagnet } from "@/lib/ai/lead-magnet";
import { buildOutreachDraft, persistOutreachDraft } from "@/lib/ai/outreach";
import { generatePainHypothesis, persistPainHypothesis } from "@/lib/ai/pain-hypothesis";
import { persistLeadScore, scoreLeadContext } from "@/lib/ai/lead-score";
import { db } from "@/lib/db";
import { enrichApolloCompanyAndContacts } from "@/lib/providers/apollo/client";
import { extractLeadWebsitePages } from "@/lib/providers/firecrawl/client";

type StageResult = {
  stage: string;
  status: JobStatus;
  error?: string;
};

export async function runCompanyFullPipeline(companyId: string) {
  const stages: StageResult[] = [];

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
        await enrichApolloCompanyAndContacts(
          {
            domain,
            companyName: company.name,
            persistCompanyId: company.id,
          },
          { persist: true },
        );
        stages.push({ stage: "enrich", status: JobStatus.SUCCEEDED });
      } else {
        stages.push({ stage: "enrich", status: JobStatus.PARTIAL, error: "No website or domain." });
      }
    } catch (error) {
      stages.push({
        stage: "enrich",
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : "Apollo enrichment failed.",
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
      stages.push({
        stage: "crawl",
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : "Firecrawl extraction failed.",
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
      },
    });

    if (!companyWithEvidence) {
      return {
        status: JobStatus.FAILED,
        error: "Lead disappeared before AI stages.",
        stages,
      };
    }

    const painHypothesis = await generatePainHypothesis({
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

    const leadMagnet = buildLeadMagnet({
      companyName: companyWithEvidence.name,
      primaryPain: painHypothesis.primary_pain,
      recommendedLeadMagnetType: painHypothesis.recommended_lead_magnet_type,
      recommendedServiceAngle: painHypothesis.recommended_service_angle,
      insufficientEvidence: painHypothesis.insufficient_evidence,
    });
    const persistedLeadMagnet = await persistLeadMagnet(companyId, leadMagnet);
    stages.push({ stage: "lead-magnet", status: JobStatus.SUCCEEDED });

    const persistedPain = await db.painHypothesis.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const diagnosticForm = buildDiagnosticFormBlueprint({
      companyName: companyWithEvidence.name,
      industry: companyWithEvidence.industry,
      primaryPain: painHypothesis.primary_pain,
      serviceAngle: painHypothesis.recommended_service_angle,
    });
    await persistDiagnosticFormBlueprint({
      companyId,
      painHypothesisId: persistedPain?.id,
      blueprint: diagnosticForm,
    });
    stages.push({ stage: "diagnostic-form", status: JobStatus.SUCCEEDED });

    const contacts = companyWithEvidence.contacts.filter((contact) => Boolean(contact.email));

    if (contacts.length === 0) {
      stages.push({
        stage: "outreach",
        status: JobStatus.PARTIAL,
        error: "No valid contacts with email were available for draft generation.",
      });

      return {
        status: JobStatus.PARTIAL,
        stages,
      };
    }

    for (const contact of contacts) {
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
        contact: {
          id: contact.id,
          fullName: contact.fullName,
          title: "title" in contact ? contact.title : undefined,
        },
      });
    }
    stages.push({ stage: "outreach", status: JobStatus.SUCCEEDED });

    return {
      status: stages.some((stage) => stage.status === JobStatus.FAILED)
        ? JobStatus.PARTIAL
        : JobStatus.SUCCEEDED,
      stages,
    };
  } catch (error) {
    return {
      status: JobStatus.FAILED,
      error: error instanceof Error ? error.message : "Full pipeline failed.",
      stages,
    };
  }
}
