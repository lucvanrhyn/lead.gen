const createAuthUrl = vi.fn();
const exchangeAuthCode = vi.fn();
const fetchGoogleWorkspaceProfile = vi.fn();
const encryptGoogleWorkspaceToken = vi.fn((value: string) => `encrypted:${value}`);
const upsertConnection = vi.fn();
const findConnection = vi.fn();

vi.mock("@/lib/providers/google-workspace/oauth", () => ({
  createGoogleWorkspaceAuthUrl: createAuthUrl,
  exchangeGoogleWorkspaceCode: exchangeAuthCode,
  fetchGoogleWorkspaceProfile: fetchGoogleWorkspaceProfile,
  encryptGoogleWorkspaceToken: encryptGoogleWorkspaceToken,
}));

vi.mock("@/lib/db", () => ({
  db: {
    googleWorkspaceConnection: {
      upsert: upsertConnection,
      findUnique: findConnection,
    },
  },
}));

describe("google workspace connect route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/google-workspace/callback",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-id",
      GOOGLE_WORKSPACE_TOKEN_SECRET: "token-secret",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("redirects to the Google consent URL when config is present", async () => {
    createAuthUrl.mockReturnValueOnce("https://accounts.google.com/o/oauth2/v2/auth?state=abc");

    const { GET } = await import("@/app/api/google-workspace/connect/route");
    const response = await GET();

    expect(createAuthUrl).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
    );
    expect(response.cookies.get("google_workspace_oauth_state")?.value).toBeTruthy();
  });

  it("stores a connected workspace after the callback succeeds", async () => {
    exchangeAuthCode.mockResolvedValueOnce({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiryDate: new Date("2026-04-01T10:00:00.000Z"),
      scopes: ["https://www.googleapis.com/auth/gmail.compose"],
    });
    fetchGoogleWorkspaceProfile.mockResolvedValueOnce({
      emailAddress: "operator@example.com",
    });
    findConnection.mockResolvedValueOnce(null);
    upsertConnection.mockResolvedValueOnce({
      id: "workspace-1",
      status: "CONNECTED",
      email: "operator@example.com",
    });

    const { GET } = await import("@/app/api/google-workspace/callback/route");
    const request = new Request(
      "http://localhost:3000/api/google-workspace/callback?code=test-code&state=match-state",
      {
        headers: {
          cookie: "google_workspace_oauth_state=match-state",
        },
      },
    );

    const response = await GET(request);

    expect(exchangeAuthCode).toHaveBeenCalledWith("test-code");
    expect(fetchGoogleWorkspaceProfile).toHaveBeenCalled();
    expect(upsertConnection).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/leads?workspace=connected");
  });
});
