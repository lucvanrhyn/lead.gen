import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("google workspace oauth token exchange", () => {
  const originalEnv = process.env;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env = {
      ...originalEnv,
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "https://leadgen-indol.vercel.app/api/google-workspace/callback",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it("posts the configured redirect uri to Google's token endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: "scope-one scope-two",
      }),
    });

    const { exchangeGoogleWorkspaceCode } = await import("@/lib/providers/google-workspace/oauth");
    await exchangeGoogleWorkspaceCode("oauth-code");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: expect.any(String),
      }),
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toContain(
      "redirect_uri=https%3A%2F%2Fleadgen-indol.vercel.app%2Fapi%2Fgoogle-workspace%2Fcallback",
    );
  });

  it("logs and throws the exact Google token exchange error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: "redirect_uri_mismatch",
          error_description: "Bad redirect URI.",
        }),
    });

    const { exchangeGoogleWorkspaceCode } = await import("@/lib/providers/google-workspace/oauth");

    await expect(exchangeGoogleWorkspaceCode("oauth-code")).rejects.toThrow(
      /redirect_uri_mismatch/i,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Google OAuth token exchange failed",
      expect.objectContaining({
        redirectUri: "https://leadgen-indol.vercel.app/api/google-workspace/callback",
        status: 400,
        responseBody: expect.stringContaining("redirect_uri_mismatch"),
      }),
    );
  });
});
