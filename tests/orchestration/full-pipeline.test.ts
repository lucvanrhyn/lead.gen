export {};

const companyFindUnique = vi.fn();
const companyUpdate = vi.fn();
const companyUpdateMany = vi.fn();
const contactFindMany = vi.fn();
const painHypothesisFindFirst = vi.fn();
const enrichmentJobCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: companyFindUnique,
      update: companyUpdate,
      updateMany: companyUpdateMany,
    },
    contact: {
      findMany: contactFindMany,
    },
    painHypothesis: {
      findFirst: painHypothesisFindFirst,
    },
    businessContext: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    leadScore: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    leadMagnet: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    diagnosticFormBlueprint: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    enrichmentJob: {
      create: enrichmentJobCreate,
    },
  },
}));

const persistPainHypothesis = vi.fn();
const generateLeadScore = vi.fn();
const persistLeadScore = vi.fn();
const buildLeadMagnet = vi.fn();
const persistLeadMagnet = vi.fn();
const buildDiagnosticFormBlueprint = vi.fn();
const persistDiagnosticFormBlueprint = vi.fn();
const createLiveDiagnosticFormLink = vi.fn();
const generateOutreachDraft = vi.fn();
const mapLlmOutreachToOutreachSchema = vi.fn();
const persistOutreachDraft = vi.fn();
const evaluateOutreachSuppression = vi.fn();
const buildCampaignAnalytics = vi.fn();
const persistBusinessContext = vi.fn();
const extractBusinessContextAndPain = vi.fn();
const runQaCheck = vi.fn();
const resolvePlaybook = vi.fn();
const createFollowUpSkeletons = vi.fn();

vi.mock("@/lib/ai/pain-hypothesis", () => ({
  persistPainHypothesis,
  buildInsufficientEvidencePainHypothesis: vi.fn(),
  painHypothesisSchema: {},
}));

vi.mock("@/lib/ai/lead-score", () => ({
  persistLeadScore,
  generateLeadScore,
  scoreLeadContext: vi.fn(() => ({
    totalScore: 81,
    componentScores: {},
    explanation: "ok",
  })),
}));

vi.mock("@/lib/ai/business-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/business-context")>();
  return {
    ...actual,
    persistBusinessContext,
  };
});

vi.mock("@/lib/ai/business-context-and-pain", () => ({
  extractBusinessContextAndPain,
  businessContextAndPainSchema: {},
}));

vi.mock("@/lib/ai/qa-check", () => ({
  runQaCheck,
}));

vi.mock("@/lib/config/playbooks", () => ({
  resolvePlaybook,
}));

vi.mock("@/lib/domain/follow-up-scheduler", () => ({
  createFollowUpSkeletons,
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
  generateOutreachDraft,
  mapLlmOutreachToOutreachSchema,
  persistOutreachDraft,
  evaluateOutreachSuppression,
  buildCampaignAnalytics,
}));

vi.mock("@/lib/providers/apollo/client", () => ({
  enrichApolloCompanyAndContacts: vi.fn(),
}));

vi.mock("@/lib/providers/firecrawl/client", () => ({
  extractLeadWebsitePages: vi.fn(),
  extractEmailsFromPages: vi.fn(() => []),
  persistContactsFromCrawl: vi.fn(),
}));

vi.mock("@/lib/orchestration/email-cascade", () => ({
  runEmailDiscoveryCascade: vi.fn().mockResolvedValue({
    source: "firecrawl",
    contacts: [],
    contactsCreated: 0,
    warnings: [],
    flagForLinkedIn: false,
  }),
}));

describe("runCompanyFullPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Concurrency lock: allow pipeline to proceed
    companyUpdateMany.mockResolvedValue({ count: 1 });

    companyFindUnique.mockResolvedValue({
      id: "company-1",
      name: "Atlas Dental Group",
      website: null,
      industry: "Dental Clinics",
      employeeCount: 48,
      phone: null,
      locationSummary: "Cape Town, South Africa",
      description: null,
      normalizedDomain: null,
      contacts: [
        {
          id: "contact-1",
          companyId: "company-1",
          fullName: "Jane Demo",
          firstName: "Megan",
          title: "Practice Manager",
          email: "jane@demo-dental.invalid",
          phone: null,
          seniority: null,
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
    contactFindMany.mockResolvedValue([{ id: "contact-1" }]);
    painHypothesisFindFirst.mockResolvedValue({ id: "pain-1" });
    extractBusinessContextAndPain.mockResolvedValue({
      business_context: {
        website_summary: "Atlas Dental Group is a dental clinic.",
        services_offerings: ["dental checkups", "orthodontics"],
        customer_type: "b2c",
        weak_lead_capture_signals: [],
        operational_clues: [],
        urgency_signals: [],
        decision_maker_clues: [],
        tone_brand_clues: [],
      },
      pain_hypothesis: {
        primary_pain: "Inconsistent booking conversion across service lines",
        secondary_pains: [],
        evidence: [],
        business_impact: "Missed conversion opportunities likely reduce bookings.",
        confidence_score: 0.72,
        recommended_service_angle: "Conversion-focused website teardown for treatment pages",
        recommended_lead_magnet_type: "website conversion teardown",
        insufficient_evidence: false,
        company_summary: "A dental group with multiple service lines.",
        observed_signals: [],
        likely_pains: [],
        best_outreach_angle: "Focus on booking conversion.",
        caution_do_not_claim: [],
      },
    });
    persistBusinessContext.mockResolvedValue(undefined);
    resolvePlaybook.mockReturnValue({
      industryKey: "dental",
      aliases: ["dental"],
      commonPains: ["patient acquisition"],
      offerAngles: ["booking flow"],
      preferredLeadMagnetTypes: ["booking-flow audit"],
      messagingFocus: "help clinics get more bookings",
      ctaPreferences: ["send over the audit"],
      toneGuidance: "professional, empathetic",
      doNotMention: ["price"],
    });
    generateLeadScore.mockResolvedValue({
      total_score: 72,
      sub_scores: {
        icp_fit: { score: 80, rationale: "Good fit." },
        pain_likelihood: { score: 70, rationale: "Plausible pain." },
        reachability: { score: 75, rationale: "Email available." },
        personalization_surface_area: { score: 60, rationale: "Some context." },
        commercial_potential: { score: 65, rationale: "Mid-size clinic." },
        urgency_trigger_signals: { score: 55, rationale: "No strong urgency." },
      },
      confidence: 0.8,
      rationale: "Solid dental lead.",
      recommended_action: "pursue",
      recommended_channel: "email",
      recommended_primary_contact_index: 0,
    });
    persistLeadMagnet.mockResolvedValue({
      id: "lead-magnet-1",
      title: "Atlas Dental Booking Funnel Teardown",
      summary: "A focused review of homepage-to-booking friction.",
      whyItMatchesTheLead: "The site positions high-value services prominently.",
      suggestedDeliveryFormat: "5-slide PDF",
    });
    buildLeadMagnet.mockResolvedValue({
      title: "Atlas Dental Booking Funnel Teardown",
      type: "website conversion teardown",
      summary: "A focused review of homepage-to-booking friction.",
      why_it_matches_the_lead: "The site positions high-value services prominently.",
      suggested_delivery_format: "5-slide PDF",
      estimated_time_to_prepare: "45 minutes",
      suggested_outreach_mention: "I put together a short review.",
      content_body: "",
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
    runQaCheck.mockResolvedValue({
      passed: true,
      issues: [],
      revised_fields: {},
    });
    createFollowUpSkeletons.mockResolvedValue(["follow-up-1", "follow-up-2", "follow-up-3"]);
  });

  it("skips outreach draft generation when an existing contact is already in flight", async () => {
    const { runCompanyFullPipeline } = await import("@/lib/orchestration/full-pipeline");

    const result = await runCompanyFullPipeline("company-1");

    expect(persistOutreachDraft).not.toHaveBeenCalled();
    expect(generateOutreachDraft).not.toHaveBeenCalled();
    expect(result.status).toBe("PARTIAL");
    expect(result.stages.some((stage) => stage.stage === "outreach" && stage.status === "PARTIAL")).toBe(
      true,
    );
  });
});
