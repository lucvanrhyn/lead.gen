import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be defined before the module under test is imported
// ---------------------------------------------------------------------------

const contactFindFirst = vi.fn();
const contactCreate = vi.fn();
const sourceEventFindFirst = vi.fn();
const sourceEventCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    contact: {
      findFirst: contactFindFirst,
      create: contactCreate,
    },
    sourceEvent: {
      findFirst: sourceEventFindFirst,
      create: sourceEventCreate,
    },
  },
}));

// Mock disposable email check
const mockIsDisposableEmail = vi.fn().mockReturnValue(false);
vi.mock("@/lib/domain/email-validation", () => ({
  isDisposableEmail: (...args: unknown[]) => mockIsDisposableEmail(...args),
}));

// Stub global fetch for Hunter API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  runEmailDiscoveryCascade,
  type EmailCascadeInput,
} from "@/lib/orchestration/email-cascade";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(overrides: Partial<EmailCascadeInput> = {}): EmailCascadeInput {
  return {
    companyId: "comp_1",
    domain: "example.com",
    companyName: "Example Inc",
    crawlEmails: [],
    existingContacts: [],
    phone: null,
    ...overrides,
  };
}

/** Simulate Hunter account endpoint returning N available credits. */
function mockHunterCredits(available: number) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { requests: { searches: { available } } },
    }),
  });
}

/** Simulate a successful Hunter domain-search response. */
function mockHunterDomainSearch(
  emails: Array<{
    value: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    confidence?: number;
  }>,
  pattern: string | null = null,
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { emails, pattern },
    }),
  });
}

/** Simulate a Hunter email verification response. */
function mockHunterVerify(status: "valid" | "invalid" | "unknown") {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { status } }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runEmailDiscoveryCascade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no cached pattern
    sourceEventFindFirst.mockResolvedValue(null);
    sourceEventCreate.mockResolvedValue({});
    contactFindFirst.mockResolvedValue(null);
    contactCreate.mockResolvedValue({ id: "contact_new" });
  });

  // -------------------------------------------------------------------------
  // 1. Firecrawl found emails
  // -------------------------------------------------------------------------
  it("returns immediately with source 'firecrawl' when crawlEmails are present", async () => {
    const result = await runEmailDiscoveryCascade(
      baseInput({ crawlEmails: ["a@example.com", "b@example.com"] }),
    );

    expect(result.source).toBe("firecrawl");
    expect(result.contactsCreated).toBe(2);
    expect(result.hunterCreditsUsed).toBe(0);
    expect(result.flagForLinkedIn).toBe(false);
    expect(result.warnings).toEqual([]);
    // Should NOT call any external APIs
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. No Firecrawl, Hunter finds emails via domain search
  // -------------------------------------------------------------------------
  it("returns source 'hunter_search' when Hunter domain search finds emails", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    mockHunterCredits(10);
    mockHunterDomainSearch(
      [
        {
          value: "john@example.com",
          first_name: "John",
          last_name: "Doe",
          position: "CEO",
          confidence: 90,
        },
      ],
      "{first}",
    );

    const result = await runEmailDiscoveryCascade(baseInput());

    expect(result.source).toBe("hunter_search");
    expect(result.contactsCreated).toBe(1);
    expect(result.hunterCreditsUsed).toBe(1);
    expect(result.pattern).toBe("{first}");
    expect(result.flagForLinkedIn).toBe(false);
    // Should cache the result
    expect(sourceEventCreate).toHaveBeenCalledTimes(1);
    // Should persist the contact
    expect(contactCreate).toHaveBeenCalledTimes(1);

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // 3. No Firecrawl, Hunter finds pattern, verification succeeds
  // -------------------------------------------------------------------------
  it("returns source 'hunter_pattern' when pattern + verification works", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    // Credits check
    mockHunterCredits(10);
    // Domain search returns no emails but a pattern
    mockHunterDomainSearch([], "{first}.{last}");
    // Verification returns valid
    mockHunterVerify("valid");

    const result = await runEmailDiscoveryCascade(
      baseInput({
        existingContacts: [
          { firstName: "Jane", lastName: "Smith", email: null },
        ],
      }),
    );

    expect(result.source).toBe("hunter_pattern");
    expect(result.contactsCreated).toBe(1);
    expect(result.hunterCreditsUsed).toBe(2);
    expect(result.flagForLinkedIn).toBe(false);

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // 4. No Firecrawl, Hunter finds pattern, verification fails → phone fallback
  // -------------------------------------------------------------------------
  it("falls through to phone when Hunter pattern verification fails", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    mockHunterCredits(10);
    mockHunterDomainSearch([], "{first}.{last}");
    mockHunterVerify("invalid");

    const result = await runEmailDiscoveryCascade(
      baseInput({
        existingContacts: [
          { firstName: "Jane", lastName: "Smith", email: null },
        ],
        phone: "+1234567890",
      }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(1);
    expect(result.flagForLinkedIn).toBe(true);
    expect(result.warnings).toContain(
      "Hunter pattern found but no verified emails generated",
    );

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // 5. No Firecrawl, Hunter credits exhausted → phone fallback
  // -------------------------------------------------------------------------
  it("falls through to phone when Hunter credits are exhausted", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    mockHunterCredits(0);

    const result = await runEmailDiscoveryCascade(
      baseInput({ phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(1);
    expect(result.warnings).toContain("Hunter credits exhausted");

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // 6. No Firecrawl, no Hunter key configured → phone fallback
  // -------------------------------------------------------------------------
  it("falls through to phone when no Hunter API key is set", async () => {
    delete process.env.HUNTER_API_KEY;

    const result = await runEmailDiscoveryCascade(
      baseInput({ phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(1);
    // No Hunter-specific warnings since there's no key at all
    expect(result.flagForLinkedIn).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. No Firecrawl, lead score < 60 → skips Hunter, falls through to phone
  // -------------------------------------------------------------------------
  it("skips Hunter when lead score is below 60", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    mockHunterCredits(10);

    const result = await runEmailDiscoveryCascade(
      baseInput({ leadScore: 45, phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(1);
    expect(result.warnings).toContain("Lead score below Hunter threshold");

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // 8. Phone fallback creates contact with flagForLinkedIn
  // -------------------------------------------------------------------------
  it("creates a phone-only contact and flags for LinkedIn", async () => {
    delete process.env.HUNTER_API_KEY;

    const result = await runEmailDiscoveryCascade(
      baseInput({ domain: null, phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(1);
    expect(result.hunterCreditsUsed).toBe(0);
    expect(result.pattern).toBeNull();
    expect(result.flagForLinkedIn).toBe(true);

    expect(contactCreate).toHaveBeenCalledWith({
      data: {
        companyId: "comp_1",
        fullName: "Example Inc",
        phone: "+1234567890",
        decisionMakerConfidence: 0.3,
      },
    });
  });

  // -------------------------------------------------------------------------
  // 8b. Phone fallback skips creation when contact already exists
  // -------------------------------------------------------------------------
  it("does not duplicate phone contact when one already exists", async () => {
    delete process.env.HUNTER_API_KEY;

    contactFindFirst.mockResolvedValue({ id: "existing_contact" });

    const result = await runEmailDiscoveryCascade(
      baseInput({ domain: null, phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.contactsCreated).toBe(0);
    expect(contactCreate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 9. No phone available → returns "none"
  // -------------------------------------------------------------------------
  it("returns source 'none' when no discovery path is available", async () => {
    delete process.env.HUNTER_API_KEY;

    const result = await runEmailDiscoveryCascade(
      baseInput({ domain: null, phone: null }),
    );

    expect(result.source).toBe("none");
    expect(result.contactsCreated).toBe(0);
    expect(result.hunterCreditsUsed).toBe(0);
    expect(result.flagForLinkedIn).toBe(true);
    expect(result.warnings).toContain("No email discovery source available");
  });

  // -------------------------------------------------------------------------
  // Edge: cached pattern path with valid verification
  // -------------------------------------------------------------------------
  it("uses cached pattern to generate and verify emails", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    // Return a cached pattern
    sourceEventFindFirst.mockResolvedValue({
      payload: { pattern: "{first}.{last}" },
    });

    // Credits check for verification
    mockHunterCredits(5);
    // Verification succeeds
    mockHunterVerify("valid");

    const result = await runEmailDiscoveryCascade(
      baseInput({
        existingContacts: [
          { firstName: "Alice", lastName: "Wonder", email: null },
        ],
      }),
    );

    expect(result.source).toBe("hunter_pattern");
    expect(result.contactsCreated).toBe(1);
    expect(result.hunterCreditsUsed).toBe(1);
    expect(result.pattern).toBe("{first}.{last}");
    // Should NOT have called domain-search (used cache instead)

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // Edge: Hunter domain search throws → falls through with warning
  // -------------------------------------------------------------------------
  it("catches Hunter domain search errors and falls through", async () => {
    process.env.HUNTER_API_KEY = "test_key";

    mockHunterCredits(10);
    // Domain search fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await runEmailDiscoveryCascade(
      baseInput({ phone: "+1234567890" }),
    );

    expect(result.source).toBe("google_places_phone");
    expect(result.warnings).toContain("Hunter domain search failed");

    delete process.env.HUNTER_API_KEY;
  });

  // -------------------------------------------------------------------------
  // Disposable email filtering
  // -------------------------------------------------------------------------
  it("filters disposable emails from crawlEmails and continues cascade", async () => {
    // Mark the mailinator email as disposable
    mockIsDisposableEmail.mockImplementation(
      (email: string) => email.includes("mailinator.com"),
    );

    const result = await runEmailDiscoveryCascade(
      baseInput({
        crawlEmails: ["real@example.com", "fake@mailinator.com"],
        phone: null,
      }),
    );

    expect(result.source).toBe("firecrawl");
    expect(result.contactsCreated).toBe(1); // Only the non-disposable email
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Filtered 1 disposable email(s)"),
      ]),
    );
  });

  it("falls through when ALL crawl emails are disposable", async () => {
    mockIsDisposableEmail.mockReturnValue(true);

    const result = await runEmailDiscoveryCascade(
      baseInput({
        crawlEmails: ["fake@mailinator.com"],
        domain: null,
        phone: "+1234567890",
      }),
    );

    // Should skip firecrawl step and fall through to phone
    expect(result.source).toBe("google_places_phone");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Filtered 1 disposable email(s)"),
      ]),
    );
  });
});
