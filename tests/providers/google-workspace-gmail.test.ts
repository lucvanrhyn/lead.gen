import { buildGmailDraftRawMessage } from "@/lib/providers/google-workspace/gmail";

describe("buildGmailDraftRawMessage", () => {
  it("builds a base64url encoded MIME message for a draft", () => {
    const raw = buildGmailDraftRawMessage({
      to: "megan@atlasdental.co.za",
      subject: "A quick idea for Atlas Dental bookings",
      body: "Hello Megan",
    });

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );

    expect(decoded).toContain("To: megan@atlasdental.co.za");
    expect(decoded).toContain("Subject: A quick idea for Atlas Dental bookings");
    expect(decoded).toContain("Hello Megan");
  });
});
