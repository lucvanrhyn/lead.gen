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

  it("asks for reconnect when the stored connection is missing the required scopes", () => {
    expect(
      deriveGoogleWorkspaceState({
        hasClientId: true,
        hasClientSecret: true,
        hasRedirectUri: true,
        hasSpreadsheetId: true,
        hasTokenSecret: true,
        connection: {
          status: "CONNECTED",
          email: "operator@example.com",
          scopes: ["https://www.googleapis.com/auth/gmail.compose"],
        },
      }),
    ).toMatchObject({
      status: "ERROR",
      canStartOAuth: true,
      connectedEmail: "operator@example.com",
    });
  });
});
