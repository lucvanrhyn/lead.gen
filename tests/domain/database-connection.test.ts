import { getDatabaseConnectionString } from "@/lib/database-connection";

describe("getDatabaseConnectionString", () => {
  it("returns the configured database url when present", () => {
    expect(
      getDatabaseConnectionString({
        DATABASE_URL: "postgresql://remote",
      }),
    ).toBe("postgresql://remote");
  });

  it("strips an accidental DATABASE_URL= prefix from the configured value", () => {
    expect(
      getDatabaseConnectionString({
        DATABASE_URL: "DATABASE_URL=postgresql://remote",
      }),
    ).toBe("postgresql://remote");
  });

  it("falls back to the local development database url", () => {
    expect(getDatabaseConnectionString({})).toBe(
      "postgresql://lead_intelligence:lead_intelligence@localhost:5432/lead_intelligence",
    );
  });
});
