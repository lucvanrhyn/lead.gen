import {
  CompanyStatus,
  CrawlPageType,
  EnrichmentStage,
  JobStatus,
  PrismaClient,
  SourceProvider,
} from "@prisma/client";

import { companySeedGraphSchema } from "../lib/domain/lead-records";

const prisma = new PrismaClient();

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
    },
  });

  if (company.contacts[0]) {
    await prisma.outreachDraft.create({
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
      },
    });
  }
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
