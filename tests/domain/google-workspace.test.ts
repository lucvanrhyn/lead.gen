import { deriveGoogleWorkspaceState } from "@/lib/domain/google-workspace";

describe("deriveGoogleWorkspaceState", () => {
  it("reports disconnected when OAuth env is present but no tokens are stored", () => {
    expect(
      deriveGoogleWorkspaceState({
        hasClientId: true,
        hasClientSecret: true,
        hasRedirectUri: true,
        hasSpreadsheetId: true,
        hasTokenSecret: true,
        connection: null,
      }),
    ).toMatchObject({
      status: "DISCONNECTED",
      canStartOAuth: true,
    });
  });
});
