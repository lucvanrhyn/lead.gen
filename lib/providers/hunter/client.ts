const HUNTER_ACCOUNT_URL = "https://api.hunter.io/v2/account";
const HUNTER_DOMAIN_SEARCH_URL = "https://api.hunter.io/v2/domain-search";
const HUNTER_EMAIL_VERIFIER_URL = "https://api.hunter.io/v2/email-verifier";

type FetchLike = typeof fetch;

export type NormalizedHunterContact = {
  email: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  seniority: string | null;
  confidence: number;
};

function getHunterApiKey(apiKey?: string): string | null {
  return apiKey || process.env.HUNTER_API_KEY || null;
}

export async function getHunterCreditsRemaining(
  options?: { apiKey?: string; fetchFn?: FetchLike },
): Promise<number> {
  const key = getHunterApiKey(options?.apiKey);

  if (!key) {
    return 0;
  }

  const fetchFn = options?.fetchFn ?? fetch;

  try {
    const response = await fetchFn(`${HUNTER_ACCOUNT_URL}?api_key=${key}`);

    if (!response.ok) {
      return 0;
    }

    const json = await response.json();
    const remaining =
      (json.data?.requests?.searches?.available ?? 0) -
      (json.data?.requests?.searches?.used ?? 0);

    return Math.max(0, remaining);
  } catch (error) {
    console.warn("[hunter] Failed to fetch remaining credits:", error);
    return 0;
  }
}

function normalizeHunterEmail(raw: {
  value?: string;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  department?: string | null;
  seniority?: string | null;
  confidence?: number;
}): NormalizedHunterContact | null {
  if (!raw.value) return null;

  const firstName = raw.first_name ?? null;
  const lastName = raw.last_name ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || raw.value.split("@")[0];

  return {
    email: raw.value,
    fullName,
    firstName,
    lastName,
    title: raw.position ?? null,
    department: raw.department ?? null,
    seniority: raw.seniority ?? null,
    confidence: raw.confidence ?? 0,
  };
}

export async function hunterDomainSearch(
  domain: string,
  options?: { apiKey?: string; fetchFn?: FetchLike },
): Promise<{
  emails: NormalizedHunterContact[];
  pattern: string | null;
  organization: string | null;
}> {
  const key = getHunterApiKey(options?.apiKey);

  if (!key) {
    return { emails: [], pattern: null, organization: null };
  }

  const fetchFn = options?.fetchFn ?? fetch;

  const response = await fetchFn(
    `${HUNTER_DOMAIN_SEARCH_URL}?domain=${encodeURIComponent(domain)}&api_key=${key}`,
  );

  if (!response.ok) {
    throw new Error(`Hunter domain search failed with status ${response.status}`);
  }

  const json = await response.json();
  const data = json.data ?? {};

  const emails: NormalizedHunterContact[] = (data.emails ?? [])
    .map(normalizeHunterEmail)
    .filter((c: NormalizedHunterContact | null): c is NormalizedHunterContact => c !== null);

  return {
    emails,
    pattern: data.pattern ?? null,
    organization: data.organization ?? null,
  };
}

export async function hunterVerifyEmail(
  email: string,
  options?: { apiKey?: string; fetchFn?: FetchLike },
): Promise<{
  status: string;
  score: number;
}> {
  const key = getHunterApiKey(options?.apiKey);

  if (!key) {
    return { status: "unknown", score: 0 };
  }

  const fetchFn = options?.fetchFn ?? fetch;

  try {
    const response = await fetchFn(
      `${HUNTER_EMAIL_VERIFIER_URL}?email=${encodeURIComponent(email)}&api_key=${key}`,
    );

    if (!response.ok) {
      return { status: "unknown", score: 0 };
    }

    const json = await response.json();
    const data = json.data ?? {};

    return {
      status: data.status ?? "unknown",
      score: data.score ?? 0,
    };
  } catch (error) {
    console.warn("[hunter] Failed to verify email:", error);
    return { status: "unknown", score: 0 };
  }
}

const PATTERN_HANDLERS: Record<string, (first: string, last: string) => string> = {
  "{first}.{last}": (first, last) => `${first}.${last}`,
  "{first}": (first) => first,
  "{f}{last}": (first, last) => `${first[0]}${last}`,
  "{first}{last}": (first, last) => `${first}${last}`,
  "{first}_{last}": (first, last) => `${first}_${last}`,
};

export function generateCandidateEmails(
  pattern: string,
  contacts: Array<{ firstName?: string | null; lastName?: string | null }>,
): string[] {
  const handler = PATTERN_HANDLERS[pattern];

  if (!handler) {
    return [];
  }

  const results: string[] = [];

  for (const contact of contacts) {
    const first = contact.firstName?.toLowerCase().trim();
    const last = contact.lastName?.toLowerCase().trim();

    if (!first || !last) {
      continue;
    }

    results.push(handler(first, last));
  }

  return results;
}

export async function persistContactsFromHunter(
  companyId: string,
  contacts: NormalizedHunterContact[],
): Promise<number> {
  if (contacts.length === 0) return 0;

  const { db } = await import("@/lib/db");
  let created = 0;

  for (const contact of contacts.slice(0, 5)) {
    const existing = await db.contact.findFirst({
      where: { companyId, email: contact.email },
    });

    if (!existing) {
      await db.contact.create({
        data: {
          companyId,
          fullName: contact.fullName,
          email: contact.email,
          title: contact.title,
          seniority: contact.seniority,
          decisionMakerConfidence: contact.confidence / 100,
        },
      });
      created += 1;
    }
  }

  return created;
}
