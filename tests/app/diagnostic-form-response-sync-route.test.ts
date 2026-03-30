const findBlueprint = vi.fn();
const findConnection = vi.fn();
const findCompany = vi.fn();
const updateLink = vi.fn();
const persistLeadScore = vi.fn();
const syncGoogleWorkspaceDiagnosticResponses = vi.fn();
const createAuthorizedGoogleClient = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    diagnosticFormBlueprint: {
      findFirst: findBlueprint,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
    company: {
      findUnique: findCompany,
    },
    diagnosticFormLink: {
      update: updateLink,
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/forms", () => ({
  syncGoogleWorkspaceDiagnosticResponses,
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
}));

vi.mock("@/lib/ai/lead-score", () => ({
  persistLeadScore,
  scoreLeadContext: vi.fn(() => ({
    total_score: 91,
    components: {
      icp_fit: 85,
      data_completeness: 90,
      contactability: 80,
      decision_maker_certainty: 84,
      pain_evidence_strength: 78,
      urgency_signals: 92,
      serviceability: 88,
      outreach_confidence: 95,
    },
    explanation: "Synced from diagnostic response.",
  })),
}));

describe("diagnostic form response sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs the latest Google Form response and updates lead scoring", async () => {
    findBlueprint.mockResolvedValueOnce({
      id: "blueprint-1",
      companyId: "lead-1",
      formSections: [],
      formLink: {
        url: "https://docs.google.com/forms/d/form-123/viewform",
      },
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
      scopes: [
        "https://www.googleapis.com/auth/forms.body",
        "https://www.googleapis.com/auth/forms.responses.readonly",
      ],
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "oauth-token" });
    syncGoogleWorkspaceDiagnosticResponses.mockResolvedValueOnce({
      responseCount: 1,
      latestResponse: {
        responseId: "response-1",
        submittedAt: "2026-03-30T08:00:00.000Z",
        summary: {
          urgencyLevel: "HIGH",
          budgetReadiness: "READY",
          workflowDetailDepth: "DETAILED",
          keyPain: "Lead follow-up leakage after consultation requests.",
          latestResponseId: "response-1",
        },
      },
    });
    findCompany.mockResolvedValueOnce({
      id: "lead-1",
      industry: "Dental Clinics",
      employeeCount: 48,
      website: "https://atlasdental.co.za",
      phone: "+27 21 555 0133",
      locationSummary: "Cape Town, South Africa",
      contacts: [
        {
          email: "megan@atlasdental.co.za",
          phone: "+27 21 555 0133",
          decisionMakerConfidence: 0.82,
        },
      ],
      painHypotheses: [
        {
          confidenceScore: 0.72,
          evidence: [{}, {}],
          insufficientEvidence: false,
        },
      ],
      technologyProfiles: [{ id: "tech-1" }],
      newsMentions: [{ id: "news-1" }],
    });
    updateLink.mockResolvedValueOnce({
      id: "form-link-1",
      responseStatus: "RESPONDED",
      responseSummary: {
        urgencyLevel: "HIGH",
      },
      scoreImpact: {
        totalScore: 91,
      },
    });

    const { POST } = await import(
      "@/app/api/leads/[id]/diagnostic-form-responses/sync/route"
    );
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: "lead-1" }),
    } as RouteContext<"/api/leads/[id]/diagnostic-form-responses/sync">);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(syncGoogleWorkspaceDiagnosticResponses).toHaveBeenCalledWith(
      expect.objectContaining({
        formUrl: "https://docs.google.com/forms/d/form-123/viewform",
      }),
    );
    expect(updateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseStatus: "RESPONDED",
          responseSummary: expect.objectContaining({
            latestResponseId: "response-1",
          }),
          scoreImpact: expect.objectContaining({
            totalScore: 91,
          }),
        }),
      }),
    );
    expect(persistLeadScore).toHaveBeenCalled();
    expect(payload.responseCount).toBe(1);
  });
});

export {};
