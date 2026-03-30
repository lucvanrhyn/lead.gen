export {};

const companyFindUnique = vi.fn();
const painHypothesisFindFirst = vi.fn();
const enrichmentJobCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: companyFindUnique,
    },
    painHypothesis: {
      findFirst: painHypothesisFindFirst,
    },
    enrichmentJob: {
      create: enrichmentJobCreate,
    },
  },
}));

const generatePainHypothesis = vi.fn();
const persistPainHypothesis = vi.fn();
const persistLeadScore = vi.fn();
const buildLeadMagnet = vi.fn();
const persistLeadMagnet = vi.fn();
const buildDiagnosticFormBlueprint = vi.fn();
const persistDiagnosticFormBlueprint = vi.fn();
const createLiveDiagnosticFormLink = vi.fn();
const buildOutreachDraft = vi.fn();
const persistOutreachDraft = vi.fn();
const evaluateOutreachSuppression = vi.fn();
const buildCampaignAnalytics = vi.fn();

vi.mock("@/lib/ai/pain-hypothesis", () => ({
  generatePainHypothesis,
  persistPainHypothesis,
}));

vi.mock("@/lib/ai/lead-score", () => ({
  persistLeadScore,
  scoreLeadContext: vi.fn(() => ({
    totalScore: 81,
    componentScores: {},
    explanation: "ok",
  })),
}));

vi.mock("@/lib/ai/lead-magnet", () => ({
  buildLeadMagnet,
  persistLeadMagnet,
}));

vi.mock("@/lib/ai/diagnostic-form", () => ({
  buildDiagnosticFormBlueprint,
  persistDiagnosticFormBlueprint,
}));

vi.mock("@/lib/domain/diagnostic-form-links", () => ({
  createLiveDiagnosticFormLink,
}));

vi.mock("@/lib/ai/outreach", () => ({
  buildOutreachDraft,
  persistOutreachDraft,
  evaluateOutreachSuppression,
  buildCampaignAnalytics,
}));

vi.mock("@/lib/providers/apollo/client", () => ({
  enrichApolloCompanyAndContacts: vi.fn(),
}));

vi.mock("@/lib/providers/firecrawl/client", () => ({
  extractLeadWebsitePages: vi.fn(),
}));

describe("runCompanyFullPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    companyFindUnique.mockResolvedValue({
      id: "company-1",
      name: "Atlas Dental Group",
      website: null,
      industry: "Dental Clinics",
      employeeCount: 48,
      phone: null,
      locationSummary: "Cape Town, South Africa",
      normalizedDomain: null,
      contacts: [
        {
          id: "contact-1",
          companyId: "company-1",
          fullName: "Megan Jacobs",
          firstName: "Megan",
          title: "Practice Manager",
          email: "megan@atlasdental.co.za",
          decisionMakerConfidence: 0.82,
        },
      ],
      crawlPages: [],
      technologyProfiles: [],
      newsMentions: [],
      painHypotheses: [],
      outreachDrafts: [
        {
          id: "draft-1",
          companyId: "company-1",
          contactId: "contact-1",
          createdAt: new Date("2026-03-29T10:00:00Z"),
          approvalStatus: "APPROVED",
          gmailDraftLink: {
            syncStatus: "SYNCED",
          },
        },
      ],
      engagementEvents: [],
    });
    painHypothesisFindFirst.mockResolvedValue({ id: "pain-1" });
    generatePainHypothesis.mockResolvedValue({
      primary_pain: "Inconsistent booking conversion across service lines",
      secondary_pains: [],
      evidence: [],
      business_impact: "Missed conversion opportunities likely reduce bookings.",
      confidence_score: 0.72,
      recommended_service_angle: "Conversion-focused website teardown for treatment pages",
      recommended_lead_magnet_type: "website conversion teardown",
      insufficient_evidence: false,
    });
    persistLeadMagnet.mockResolvedValue({
      id: "lead-magnet-1",
      title: "Atlas Dental Booking Funnel Teardown",
      summary: "A focused review of homepage-to-booking friction.",
      whyItMatchesTheLead: "The site positions high-value services prominently.",
      suggestedDeliveryFormat: "5-slide PDF",
    });
    buildLeadMagnet.mockReturnValue({
      title: "Atlas Dental Booking Funnel Teardown",
      type: "website conversion teardown",
      summary: "A focused review of homepage-to-booking friction.",
      whyItMatchesTheLead: "The site positions high-value services prominently.",
      suggestedDeliveryFormat: "5-slide PDF",
      estimatedTimeToPrepare: "45 minutes",
    });
    buildDiagnosticFormBlueprint.mockReturnValue({
      outreach_cta_short: "I put together a short 2-minute workflow diagnostic for dental clinics.",
      outreach_cta_medium: "I made a quick bottleneck assessment form tailored to dental clinics.",
    });
    persistDiagnosticFormBlueprint.mockResolvedValue({
      id: "blueprint-1",
    });
    createLiveDiagnosticFormLink.mockResolvedValue({
      responderUrl: "https://docs.google.com/forms/d/form-123/viewform",
    });
    evaluateOutreachSuppression.mockReturnValue({
      suppressed: true,
      reason: "duplicate_contact",
    });
    buildCampaignAnalytics.mockReturnValue({
      sentCount: 0,
      viewedCount: 0,
      repliedCount: 0,
      followUpDueCount: 0,
      suppressedCount: 1,
    });
    enrichmentJobCreate.mockResolvedValue({
      id: "job-1",
    });
  });

  it("skips outreach draft generation when an existing contact is already in flight", async () => {
    const { runCompanyFullPipeline } = await import("@/lib/orchestration/full-pipeline");

    const result = await runCompanyFullPipeline("company-1");

    expect(persistOutreachDraft).not.toHaveBeenCalled();
    expect(buildOutreachDraft).not.toHaveBeenCalled();
    expect(result.status).toBe("PARTIAL");
    expect(result.stages.some((stage) => stage.stage === "outreach" && stage.status === "PARTIAL")).toBe(
      true,
    );
  });
});
