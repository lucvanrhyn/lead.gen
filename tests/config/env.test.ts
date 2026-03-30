import { describe, expect, it } from "vitest";

import {
  getGoogleOAuthConfig,
  getOptionalTrimmedEnv,
  isPresentEnvValue,
} from "@/lib/config/env";

describe("env helpers", () => {
  it("treats blank and whitespace-only env values as absent", () => {
    expect(isPresentEnvValue(undefined)).toBe(false);
    expect(isPresentEnvValue("")).toBe(false);
    expect(isPresentEnvValue("   \n  ")).toBe(false);
    expect(isPresentEnvValue(" value ")).toBe(true);
  });

  it("returns trimmed optional env values", () => {
    expect(
      getOptionalTrimmedEnv("APP_BASE_URL", {
        APP_BASE_URL: " https://leadgen-indol.vercel.app/ \n",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://leadgen-indol.vercel.app/");
  });

  it("trims google oauth values before returning config", () => {
    expect(
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID:
          "686361954061-s7imevph7f5fj9tkiiqae38mpvbb2d0k.apps.googleusercontent.com\n",
        GOOGLE_OAUTH_CLIENT_SECRET: " secret-value \n",
        GOOGLE_OAUTH_REDIRECT_URI:
          " https://leadgen-indol.vercel.app/api/google-workspace/callback \n",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      clientId:
        "686361954061-s7imevph7f5fj9tkiiqae38mpvbb2d0k.apps.googleusercontent.com",
      clientSecret: "secret-value",
      redirectUri: "https://leadgen-indol.vercel.app/api/google-workspace/callback",
    });
  });

  it("throws when google oauth config is missing after trimming", () => {
    expect(() =>
      getGoogleOAuthConfig({
        GOOGLE_OAUTH_CLIENT_ID: " \n ",
        GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
        GOOGLE_OAUTH_REDIRECT_URI: "https://leadgen-indol.vercel.app/api/google-workspace/callback",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });
});
