import { getAppBaseUrl, resolveAppUrl } from "@/lib/domain/app-url";

describe("app url helpers", () => {
  it("prefers APP_BASE_URL when configured", () => {
    expect(
      getAppBaseUrl({
        APP_BASE_URL: "https://lead-engine.example.com",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://lead-engine.example.com");
  });

  it("falls back to request origin when APP_BASE_URL is not set", () => {
    expect(
      getAppBaseUrl(
        {} as NodeJS.ProcessEnv,
        new Request("http://localhost:3000/api/test"),
      ),
    ).toBe("http://localhost:3000");
  });

  it("builds absolute app urls from the resolved base url", () => {
    expect(
      resolveAppUrl("/assets/demo", {
        APP_BASE_URL: "https://lead-engine.example.com/",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://lead-engine.example.com/assets/demo");
  });
});
