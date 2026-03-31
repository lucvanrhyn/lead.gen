import disposableDomains from "disposable-email-domains/index.json";
import disposableWildcards from "disposable-email-domains/wildcard.json";

// ---------------------------------------------------------------------------
// In-memory Set for O(1) lookups
// ---------------------------------------------------------------------------

const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set(
  (disposableDomains as string[]).map((d) => d.toLowerCase()),
);

const DISPOSABLE_WILDCARDS: readonly string[] = (
  disposableWildcards as string[]
).map((d) => d.toLowerCase());

// ---------------------------------------------------------------------------
// RFC 5322 simplified email regex
// ---------------------------------------------------------------------------

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EmailValidationResult = {
  readonly email: string;
  readonly isValid: boolean;
  readonly isDisposable: boolean;
  readonly isFormatValid: boolean;
  readonly reason: string | null;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an email address belongs to a known disposable/throwaway
 * email provider (e.g. Mailinator, Guerrilla Mail).
 *
 * Uses an in-memory Set for O(1) domain lookups, plus wildcard subdomain
 * matching for providers that use random subdomains.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;

  const lower = domain.toLowerCase();

  // Direct match
  if (DISPOSABLE_DOMAINS.has(lower)) return true;

  // Wildcard match — check if domain ends with any wildcard suffix
  // e.g. "*.example.com" matches "abc.example.com"
  for (const wildcard of DISPOSABLE_WILDCARDS) {
    if (lower === wildcard || lower.endsWith(`.${wildcard}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate basic email format against a simplified RFC 5322 pattern.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  if (email.length > 254) return false; // RFC 5321 max length
  return EMAIL_REGEX.test(email);
}

/**
 * Combined validation: format check + disposable domain check.
 * Returns an immutable result object describing the validation outcome.
 */
export function validateEmail(email: string): EmailValidationResult {
  const isFormatValid = isValidEmailFormat(email);

  if (!isFormatValid) {
    return {
      email,
      isValid: false,
      isDisposable: false,
      isFormatValid: false,
      reason: "Invalid email format",
    };
  }

  const isDisposable = isDisposableEmail(email);

  if (isDisposable) {
    return {
      email,
      isValid: false,
      isDisposable: true,
      isFormatValid: true,
      reason: "Disposable email domain",
    };
  }

  return {
    email,
    isValid: true,
    isDisposable: false,
    isFormatValid: true,
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return parts[1] || null;
}
