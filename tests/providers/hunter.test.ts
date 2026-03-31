import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getHunterCreditsRemaining,
  hunterDomainSearch,
  hunterVerifyEmail,
  generateCandidateEmails,
} from "@/lib/providers/hunter/client";

beforeEach(() => {
  vi.stubEnv("HUNTER_API_KEY", "hunter_test_key");
});

describe("getHunterCreditsRemaining", () => {
  it("returns remaining credits from account API", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            requests: {
              searches: {
                available: 500,
                used: 123,
              },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const credits = await getHunterCreditsRemaining({
      apiKey: "hunter_test_key",
      fetchFn,
    });

    expect(credits).toBe(377);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0][0]).toContain("api.hunter.io/v2/account");
  });

  it("returns 0 when no API key is configured", async () => {
    vi.stubEnv("HUNTER_API_KEY", "");

    const credits = await getHunterCreditsRemaining({
      apiKey: "",
      fetchFn: vi.fn(),
    });

    expect(credits).toBe(0);
  });
});

describe("hunterDomainSearch", () => {
  it("returns normalized contacts from domain search response", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            domain: "demo-dental.invalid",
            organization: "Atlas Dental Group",
            pattern: "{first}.{last}",
            emails: [
              {
                value: "jane@demo-dental.invalid",
                first_name: "Jane",
                last_name: "Doe",
                position: "Practice Manager",
                department: "operations",
                seniority: "senior",
                confidence: 92,
              },
              {
                value: "john@demo-dental.invalid",
                first_name: "John",
                last_name: "Smith",
                position: "Marketing Director",
                department: "marketing",
                seniority: "director",
                confidence: 88,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await hunterDomainSearch("demo-dental.invalid", {
      apiKey: "hunter_test_key",
      fetchFn,
    });

    expect(result.emails).toHaveLength(2);
    expect(result.organization).toBe("Atlas Dental Group");
    expect(result.pattern).toBe("{first}.{last}");
    expect(result.emails[0]).toMatchObject({
      email: "jane@demo-dental.invalid",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      title: "Practice Manager",
      department: "operations",
      seniority: "senior",
      confidence: 92,
    });
  });

  it("returns pattern when no emails found", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            domain: "demo-dental.invalid",
            organization: "Atlas Dental Group",
            pattern: "{first}.{last}",
            emails: [],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await hunterDomainSearch("demo-dental.invalid", {
      apiKey: "hunter_test_key",
      fetchFn,
    });

    expect(result.emails).toEqual([]);
    expect(result.pattern).toBe("{first}.{last}");
    expect(result.organization).toBe("Atlas Dental Group");
  });

  it("throws on API errors so callers can handle them", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ details: "Unauthorized" }] }), {
        status: 401,
      }),
    );

    await expect(
      hunterDomainSearch("demo-dental.invalid", {
        apiKey: "hunter_test_key",
        fetchFn,
      }),
    ).rejects.toThrow("Hunter domain search failed with status 401");
  });
});

describe("hunterVerifyEmail", () => {
  it("returns verification status and score", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            status: "valid",
            score: 91,
            email: "jane@demo-dental.invalid",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await hunterVerifyEmail("jane@demo-dental.invalid", {
      apiKey: "hunter_test_key",
      fetchFn,
    });

    expect(result.status).toBe("valid");
    expect(result.score).toBe(91);
  });
});

describe("generateCandidateEmails", () => {
  it("generates emails with {first}.{last} pattern", () => {
    const emails = generateCandidateEmails("{first}.{last}", [
      { firstName: "Jane", lastName: "Doe" },
      { firstName: "John", lastName: "Smith" },
    ]);

    expect(emails).toEqual(["jane.doe", "john.smith"]);
  });

  it("generates emails with {f}{last} pattern", () => {
    const emails = generateCandidateEmails("{f}{last}", [
      { firstName: "Jane", lastName: "Doe" },
      { firstName: "John", lastName: "Smith" },
    ]);

    expect(emails).toEqual(["jdoe", "jsmith"]);
  });

  it("skips contacts missing names", () => {
    const emails = generateCandidateEmails("{first}.{last}", [
      { firstName: "Jane", lastName: "Doe" },
      { firstName: null, lastName: "Smith" },
      { firstName: "Bob", lastName: null },
      { firstName: "Alice", lastName: "Wonder" },
    ]);

    expect(emails).toEqual(["jane.doe", "alice.wonder"]);
  });
});
