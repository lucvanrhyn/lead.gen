const findBlueprint = vi.fn();
const findConnection = vi.fn();
const createAuthorizedGoogleClient = vi.fn();
const createGoogleWorkspaceDiagnosticForm = vi.fn();
const findExistingLink = vi.fn();
const createLink = vi.fn();
const updateLink = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    diagnosticFormBlueprint: {
      findFirst: findBlueprint,
    },
    googleWorkspaceConnection: {
      findUnique: findConnection,
    },
    diagnosticFormLink: {
      findUnique: findExistingLink,
      create: createLink,
      update: updateLink,
    },
    company: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createAuthorizedGoogleClient,
}));

vi.mock("@/lib/providers/google-workspace/forms", () => ({
  createGoogleWorkspaceDiagnosticForm,
  extractGoogleFormId: (url: string) => {
    const match = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  },
  buildGoogleFormEditUrl: (formId: string) => `https://docs.google.com/forms/d/${formId}/edit`,
}));

describe("diagnostic form link route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a live Google Form when requested and persists the responder URL", async () => {
    findBlueprint.mockResolvedValueOnce({
      id: "blueprint-1",
      formTitle: "Atlas Dental Workflow Diagnostic",
      formIntro: "A short diagnostic to pinpoint workflow friction.",
      closingMessage: "Thanks for filling this in.",
      estimatedCompletionTime: "2-4 minutes",
      industry: "Dental Clinics",
      primaryGoal: "Tighten bookings and follow-up",
      qualificationStrength: "medium",
      outreachCtaShort: "Short diagnostic",
      outreachCtaMedium: "Quick bottleneck form",
      formSections: [
        {
          section_name: "Basic business context",
          section_description: "A quick profile of the business and respondent.",
          questions: [],
        },
      ],
      formLink: null,
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
    });
    createAuthorizedGoogleClient.mockResolvedValueOnce({ token: "ok" });
    createGoogleWorkspaceDiagnosticForm.mockResolvedValueOnce({
      formId: "form-123",
      responderUrl: "https://docs.google.com/forms/d/form-123/viewform",
      editUrl: "https://docs.google.com/forms/d/form-123/edit",
    });
    findExistingLink.mockResolvedValueOnce(null);
    createLink.mockResolvedValueOnce({
      id: "link-1",
      blueprintId: "blueprint-1",
      url: "https://docs.google.com/forms/d/form-123/viewform",
      responseStatus: "LINK_ATTACHED",
    });

    const { POST } = await import("@/app/api/leads/[id]/diagnostic-form-link/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ createLiveForm: true }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "lead-1" }) } as RouteContext<"/api/leads/[id]/diagnostic-form-link">,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createGoogleWorkspaceDiagnosticForm).toHaveBeenCalled();
    expect(createLink).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://docs.google.com/forms/d/form-123/viewform",
        }),
      }),
    );
    expect(payload.editUrl).toBe("https://docs.google.com/forms/d/form-123/edit");
  });

  it("reuses the existing live Google Form instead of forking a new one", async () => {
    findBlueprint.mockResolvedValueOnce({
      id: "blueprint-1",
      formTitle: "Atlas Dental Workflow Diagnostic",
      formIntro: "A short diagnostic to pinpoint workflow friction.",
      closingMessage: "Thanks for filling this in.",
      estimatedCompletionTime: "2-4 minutes",
      industry: "Dental Clinics",
      primaryGoal: "Tighten bookings and follow-up",
      qualificationStrength: "medium",
      outreachCtaShort: "Short diagnostic",
      outreachCtaMedium: "Quick bottleneck form",
      formSections: [],
      formLink: {
        url: "https://docs.google.com/forms/d/form-999/viewform",
      },
    });
    findConnection.mockResolvedValueOnce({
      provider: "google_workspace",
      status: "CONNECTED",
    });
    findExistingLink.mockResolvedValueOnce({
      id: "link-1",
      responseStatus: "LINK_ATTACHED",
      url: "https://docs.google.com/forms/d/form-999/viewform",
    });
    updateLink.mockResolvedValueOnce({
      id: "link-1",
      blueprintId: "blueprint-1",
      url: "https://docs.google.com/forms/d/form-999/viewform",
      responseStatus: "LINK_ATTACHED",
    });

    const { POST } = await import("@/app/api/leads/[id]/diagnostic-form-link/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ createLiveForm: true }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "lead-1" }) } as RouteContext<"/api/leads/[id]/diagnostic-form-link">,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(createGoogleWorkspaceDiagnosticForm).not.toHaveBeenCalled();
    expect(payload.formId).toBe("form-999");
    expect(payload.editUrl).toBe("https://docs.google.com/forms/d/form-999/edit");
  });
});

export {};
