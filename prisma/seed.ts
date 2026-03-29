import {
  CompanyStatus,
  CrawlPageType,
  EnrichmentStage,
  JobStatus,
  SourceProvider,
} from "@prisma/client";

import { buildLeadMagnetAssetSlug } from "../lib/ai/lead-magnet";
import { createPrismaClient } from "../lib/database-connection";
import { companySeedGraphSchema } from "../lib/domain/lead-records";

const prisma = createPrismaClient();

const demoGraph = companySeedGraphSchema.parse({
  company: {
    name: "Atlas Dental Group",
    website: "https://atlasdental.co.za",
    industry: "Dental Clinics",
    location: "Cape Town, South Africa",
  },
  contacts: [
    {
      fullName: "Megan Jacobs",
      title: "Practice Manager",
      email: "megan@atlasdental.co.za",
      phone: "+27 21 555 0133",
    },
  ],
  sourceEvent: {
    provider: "manual_seed",
    url: "https://atlasdental.co.za",
    confidence: 0.92,
  },
});

async function main() {
  await prisma.diagnosticFormLink.deleteMany();
  await prisma.diagnosticFormBlueprint.deleteMany();
  await prisma.sheetSyncRecord.deleteMany();
  await prisma.gmailDraftLink.deleteMany();
  await prisma.googleWorkspaceConnection.deleteMany();
  await prisma.linkedInTask.deleteMany();
  await prisma.outreachEngagementEvent.deleteMany();
  await prisma.batchLead.deleteMany();
  await prisma.leadBatch.deleteMany();
  await prisma.leadMagnetAsset.deleteMany();
  await prisma.outreachDraft.deleteMany();
  await prisma.leadMagnet.deleteMany();
  await prisma.leadScore.deleteMany();
  await prisma.painHypothesis.deleteMany();
  await prisma.crawlPage.deleteMany();
  await prisma.newsMention.deleteMany();
  await prisma.technologyProfile.deleteMany();
  await prisma.enrichmentJob.deleteMany();
  await prisma.sourceEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.companyLocation.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: demoGraph.company.name,
      website: demoGraph.company.website,
      phone: "+27 21 555 0133",
      normalizedDomain: "atlasdental.co.za",
      industry: demoGraph.company.industry,
      locationSummary: demoGraph.company.location,
      employeeCount: 48,
      description: "Multi-location dental practice focused on family and cosmetic dentistry.",
      status: CompanyStatus.READY,
      sourceConfidence: demoGraph.sourceEvent.confidence,
      locations: {
        create: [
          {
            label: "Cape Town HQ",
            country: "South Africa",
            region: "Western Cape",
            city: "Cape Town",
            isPrimary: true,
          },
        ],
      },
      contacts: {
        create: demoGraph.contacts.map((contact) => ({
          fullName: contact.fullName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          decisionMakerConfidence: 0.76,
        })),
      },
      sourceEvents: {
        create: [
          {
            provider: SourceProvider.MANUAL_SEED,
            eventType: "seed_company_profile",
            fieldName: "company.website",
            sourceUrl: demoGraph.sourceEvent.url,
            confidence: demoGraph.sourceEvent.confidence,
          },
        ],
      },
      enrichmentJobs: {
        create: [
          {
            provider: SourceProvider.GOOGLE_PLACES,
            stage: EnrichmentStage.GOOGLE_PLACES_DISCOVERY,
            status: JobStatus.SUCCEEDED,
            attempts: 1,
            requestedBy: "seed",
          },
          {
            provider: SourceProvider.APOLLO,
            stage: EnrichmentStage.APOLLO_COMPANY_ENRICHMENT,
            status: JobStatus.PENDING,
            attempts: 0,
            requestedBy: "seed",
          },
        ],
      },
      technologyProfiles: {
        create: [
          {
            provider: SourceProvider.BUILTWITH,
            technologyName: "Cloudflare",
            category: "Infrastructure",
            evidenceUrl: "https://atlasdental.co.za",
            confidence: 0.61,
          },
        ],
      },
      crawlPages: {
        create: [
          {
            provider: SourceProvider.FIRECRAWL,
            pageType: CrawlPageType.HOMEPAGE,
            url: "https://atlasdental.co.za",
            title: "Atlas Dental Group",
            markdown:
              "Family dentistry, implants, same-week bookings, and cosmetic smile packages.",
            summary:
              "Homepage emphasizes quick bookings, cosmetic services, and multiple practice locations.",
            confidence: 0.78,
          },
        ],
      },
      painHypotheses: {
        create: [
          {
            primaryPain: "Inconsistent booking conversion across service lines",
            secondaryPains: [
              "High-value implant and cosmetic pages may not convert efficiently",
              "Multi-location messaging can dilute urgency for local bookings",
            ],
            evidence: [
              {
                source_type: "website",
                source_url: "https://atlasdental.co.za",
                snippet: "same-week bookings and cosmetic smile packages",
                signal_type: "conversion_signal",
                confidence: 0.78,
              },
            ],
            businessImpact:
              "Missed conversion opportunities likely reduce high-margin treatment bookings.",
            confidenceScore: 0.72,
            recommendedServiceAngle: "Conversion-focused website teardown for treatment pages",
            recommendedLeadMagnetType: "website conversion teardown",
            insufficientEvidence: false,
            modelProvider: SourceProvider.OPENAI,
          },
        ],
      },
      leadScores: {
        create: [
          {
            totalScore: 79,
            componentScores: {
              icp_fit: 84,
              data_completeness: 74,
              contactability: 72,
              decision_maker_certainty: 76,
              pain_evidence_strength: 79,
              urgency_signals: 68,
              serviceability: 86,
              outreach_confidence: 80,
            },
            explanation:
              "Strong local-service fit with visible conversion cues and at least one likely decision-maker contact.",
            modelProvider: SourceProvider.OPENAI,
          },
        ],
      },
      leadMagnets: {
        create: [
          {
            title: "Atlas Dental Booking Funnel Teardown",
            type: "website conversion teardown",
            summary:
              "A focused review of homepage-to-booking friction for cosmetic and implant leads.",
            whyItMatchesTheLead:
              "The site positions high-value services prominently, which creates a strong case for conversion optimization.",
            suggestedDeliveryFormat: "5-slide PDF",
            estimatedTimeToPrepare: "45 minutes",
          },
        ],
      },
    },
    include: {
      contacts: true,
      leadMagnets: true,
    },
  });

  if (company.contacts[0]) {
    const leadMagnet = company.leadMagnets[0];
    const pendingDraft = await prisma.outreachDraft.create({
      data: {
        companyId: company.id,
        contactId: company.contacts[0].id,
        emailSubject1: "A quick idea for Atlas Dental bookings",
        emailSubject2: "One conversion win for your treatment pages",
        coldEmailShort:
          "I noticed Atlas Dental highlights high-value services and quick bookings. I put together a short teardown on where treatment-page visitors may be dropping before they book.",
        coldEmailMedium:
          "I spent some time reviewing how Atlas Dental presents cosmetic and implant services online. There looks to be a real opportunity to tighten the path from interest to booked consult, especially for higher-margin pages. I drafted a short teardown with a few practical changes if useful.",
        linkedinMessageSafe:
          "I put together a short teardown on how Atlas Dental could tighten the path from treatment-page visits to booked consults. Happy to send it over if helpful.",
        followUp1:
          "Following up in case a short conversion teardown for Atlas Dental's treatment pages would be useful.",
        followUp2:
          "Happy to send the teardown if improving booking conversion is a priority this quarter.",
        approvalStatus: "PENDING_APPROVAL",
      },
    });

    if (leadMagnet) {
      await prisma.leadMagnetAsset.create({
        data: {
          companyId: company.id,
          leadMagnetId: leadMagnet.id,
          outreachDraftId: pendingDraft.id,
          slug: buildLeadMagnetAssetSlug({
            companyName: company.name,
            leadMagnetTitle: leadMagnet.title,
            outreachDraftId: pendingDraft.id,
          }),
          headline: leadMagnet.title,
          intro: leadMagnet.summary,
        },
      });
    }

    await prisma.linkedInTask.create({
      data: {
        companyId: company.id,
        contactId: company.contacts[0].id,
        outreachDraftId: pendingDraft.id,
        status: "MANUAL_LOOKUP_NEEDED",
        contactName: company.contacts[0].fullName,
        contactTitle: company.contacts[0].title,
        lookupHints: [
          "Megan Jacobs Atlas Dental Group LinkedIn",
          "Practice Manager Atlas Dental Group LinkedIn",
        ],
        connectionRequestNote:
          "Megan Jacobs, I put together a short Atlas Dental Booking Funnel Teardown after spotting a likely booking leak at Atlas Dental.",
        dmMessage:
          "I put together a short teardown on how Atlas Dental could tighten the path from treatment-page visits to booked consults. Happy to send it over if helpful.",
        followUpDm:
          "Happy to send the teardown if improving booking conversion is a priority this quarter.",
      },
    });

    const approvedDraft = await prisma.outreachDraft.create({
      data: {
        companyId: company.id,
        contactId: company.contacts[0].id,
        emailSubject1: "Atlas Dental workflow diagnostic",
        emailSubject2: "A short diagnostic for your bookings and follow-up flow",
        coldEmailShort:
          "I put together a short 2-minute workflow diagnostic for dental clinics like Atlas Dental.",
        coldEmailMedium:
          "I made a quick bottleneck assessment form tailored to practices that want to tighten bookings and follow-up before patient interest goes cold.",
        linkedinMessageSafe:
          "I made a quick booking workflow diagnostic for Atlas Dental. Happy to send it over if useful.",
        followUp1: "Following up in case the short workflow diagnostic would be useful.",
        followUp2: "Happy to send the diagnostic if tightening patient follow-up is a priority.",
        draftType: "INITIAL",
        sequenceStep: 1,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      },
    });

    await prisma.gmailDraftLink.create({
      data: {
        outreachDraftId: approvedDraft.id,
        gmailDraftId: "draft-demo-1",
        gmailThreadId: "thread-demo-1",
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });

    await prisma.sheetSyncRecord.createMany({
      data: [
        {
          outreachDraftId: approvedDraft.id,
          tabName: "Companies",
          rowKey: "2",
          syncStatus: "READY",
        },
        {
          outreachDraftId: approvedDraft.id,
          tabName: "Contacts",
          rowKey: "2",
          syncStatus: "READY",
        },
        {
          outreachDraftId: approvedDraft.id,
          tabName: "Drafts",
          rowKey: "2",
          syncStatus: "READY",
        },
        {
          outreachDraftId: approvedDraft.id,
          tabName: "LinkedIn Tasks",
          rowKey: "2",
          syncStatus: "READY",
        },
        {
          outreachDraftId: approvedDraft.id,
          tabName: "Engagement",
          rowKey: "2",
          syncStatus: "READY",
        },
      ],
    });

    await prisma.linkedInTask.create({
      data: {
        companyId: company.id,
        contactId: company.contacts[0].id,
        outreachDraftId: approvedDraft.id,
        status: "MANUAL_LOOKUP_NEEDED",
        contactName: company.contacts[0].fullName,
        contactTitle: company.contacts[0].title,
        lookupHints: [
          "Megan Jacobs Atlas Dental Group LinkedIn",
          "Practice Manager Atlas Dental Group LinkedIn",
        ],
        connectionRequestNote:
          "Megan Jacobs, I put together a short Atlas Dental workflow diagnostic after spotting a likely friction point at Atlas Dental.",
        dmMessage:
          "I made a quick booking workflow diagnostic for Atlas Dental. Happy to send it over if useful.",
        followUpDm:
          "Happy to send the diagnostic if tightening patient follow-up is a priority.",
      },
    });

    await prisma.outreachDraft.create({
      data: {
        companyId: company.id,
        contactId: company.contacts[0].id,
        parentDraftId: approvedDraft.id,
        draftType: "FOLLOW_UP",
        sequenceStep: 2,
        emailSubject1: "Atlas Dental Group follow-up",
        emailSubject2: "Checking in on the teardown",
        coldEmailShort: "Quick follow-up on the teardown.",
        coldEmailMedium:
          "I noticed the earlier note got attention and wanted to follow up while it is still fresh.",
        linkedinMessageSafe: "Quick follow-up on the teardown.",
        followUp1: "Following up on the teardown.",
        followUp2: "Happy to tailor the next recommendation if useful.",
        approvalStatus: "PENDING_APPROVAL",
      },
    });

    if (leadMagnet) {
      await prisma.leadMagnetAsset.create({
        data: {
          companyId: company.id,
          leadMagnetId: leadMagnet.id,
          outreachDraftId: approvedDraft.id,
          slug: buildLeadMagnetAssetSlug({
            companyName: company.name,
            leadMagnetTitle: leadMagnet.title,
            outreachDraftId: approvedDraft.id,
          }),
          headline: leadMagnet.title,
          intro: leadMagnet.summary,
          diagnosticFormUrl: "https://forms.gle/example-atlas-dental",
        },
      });
    }

    await prisma.outreachEngagementEvent.create({
      data: {
        outreachDraftId: approvedDraft.id,
        companyId: company.id,
        contactId: company.contacts[0].id,
        eventType: "CLICK",
        followUpCreated: true,
      },
    });
  }

  const blueprint = await prisma.diagnosticFormBlueprint.create({
    data: {
      companyId: company.id,
      industry: "Dental Clinics",
      primaryGoal: "Conversion-focused website teardown for treatment pages",
      qualificationStrength: "medium",
      estimatedCompletionTime: "2-4 minutes",
      formTitle: "Atlas Dental Workflow Diagnostic",
      formIntro:
        "A short diagnostic to pinpoint where booking and follow-up friction may be leaking high-value treatment demand.",
      closingMessage:
        "Thanks for filling this in. This gives enough context to make the next recommendation practical.",
      outreachCtaShort:
        "I put together a short 2-minute workflow diagnostic for dental clinics.",
      outreachCtaMedium:
        "I made a quick bottleneck assessment form tailored to clinics that want to tighten bookings and follow-up.",
      formSections: [
        {
          section_name: "Basic business context",
          section_description: "A quick profile of the business and respondent.",
          questions: [],
        },
        {
          section_name: "Current operational situation",
          section_description: "How the work currently flows and where friction appears.",
          questions: [],
        },
        {
          section_name: "Pain points and priorities",
          section_description: "What costs the business time, money, and momentum right now.",
          questions: [],
        },
        {
          section_name: "Lead qualification / readiness",
          section_description: "How ready the business is to act on a practical recommendation.",
          questions: [],
        },
        {
          section_name: "Optional open text",
          section_description: "Anything specific the respondent wants reviewed further.",
          questions: [],
        },
      ],
      rawPayload: {
        usage_mode: "lead_magnet_and_form",
      },
    },
  });

  await prisma.diagnosticFormLink.create({
    data: {
      blueprintId: blueprint.id,
      url: "https://forms.gle/example-atlas-dental",
      responseStatus: "LINK_ATTACHED",
    },
  });

  await prisma.googleWorkspaceConnection.create({
    data: {
      provider: "google_workspace",
      scopes: [],
      status: "DISCONNECTED",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
