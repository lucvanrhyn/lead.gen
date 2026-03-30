export {};

import { createOperatorSessionToken } from "@/lib/auth/session";

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
  let operatorSessionToken: string;

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
      OPERATOR_SESSION_SECRET: "session-secret-value",
    };
    operatorSessionToken = createOperatorSessionToken("owner@example.com", process.env);
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
          cookie: `google_workspace_oauth_state=match-state; leadgen_operator_session=${operatorSessionToken}`,
        },
      },
    );

    const response = await GET(request);

    expect(exchangeAuthCode).toHaveBeenCalledWith("test-code", expect.any(Object));
    expect(fetchGoogleWorkspaceProfile).toHaveBeenCalled();
    expect(upsertConnection).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/leads?workspace=connected");
    expect(response.cookies.get("google_workspace_oauth_state")?.value).toBe("");
  });

  it("redirects with a clear error when the callback is missing the authorization code", async () => {
    const { GET } = await import("@/app/api/google-workspace/callback/route");
    const request = new Request(
      "http://localhost:3000/api/google-workspace/callback?state=match-state",
      {
        headers: {
          cookie: `google_workspace_oauth_state=match-state; leadgen_operator_session=${operatorSessionToken}`,
        },
      },
    );

    const response = await GET(request);

    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/leads?workspace=error&reason=missing_code",
    );
    expect(upsertConnection).toHaveBeenCalledWith({
      where: { provider: "google_workspace" },
      create: {
        provider: "google_workspace",
        scopes: [],
        status: "ERROR",
        lastError: "Google OAuth callback did not include an authorization code.",
      },
      update: {
        status: "ERROR",
        lastError: "Google OAuth callback did not include an authorization code.",
      },
    });
  });

  it("redirects with a clear error when state validation fails", async () => {
    const { GET } = await import("@/app/api/google-workspace/callback/route");
    const request = new Request(
      "http://localhost:3000/api/google-workspace/callback?code=test-code&state=wrong-state",
      {
        headers: {
          cookie: `google_workspace_oauth_state=match-state; leadgen_operator_session=${operatorSessionToken}`,
        },
      },
    );

    const response = await GET(request);

    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/leads?workspace=error&reason=invalid_state",
    );
  });

  it("redirects with the Google OAuth error reason when Google returns one", async () => {
    const { GET } = await import("@/app/api/google-workspace/callback/route");
    const request = new Request(
      "http://localhost:3000/api/google-workspace/callback?error=access_denied&state=match-state",
      {
        headers: {
          cookie: `google_workspace_oauth_state=match-state; leadgen_operator_session=${operatorSessionToken}`,
        },
      },
    );

    const response = await GET(request);

    expect(exchangeAuthCode).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/leads?workspace=error&reason=access_denied",
    );
  });

  it("redirects unauthenticated callback failures to login with a visible error", async () => {
    const { GET } = await import("@/app/api/google-workspace/callback/route");
    const request = new Request(
      "http://localhost:3000/api/google-workspace/callback?state=match-state",
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=google_workspace_callback",
    );
  });
});
