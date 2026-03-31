import { SourceProvider } from "@prisma/client";
import {
  type NormalizedHunterContact,
  generateCandidateEmails,
  getHunterCreditsRemaining,
  hunterDomainSearch,
  hunterVerifyEmail,
  persistContactsFromHunter,
} from "@/lib/providers/hunter/client";

export type EmailCascadeResult = {
  source: "firecrawl" | "hunter_search" | "hunter_pattern" | "google_places_phone" | "none";
  contactsCreated: number;
  hunterCreditsUsed: number;
  pattern: string | null;
  flagForLinkedIn: boolean;
  warnings: string[];
};

export type EmailCascadeInput = {
  companyId: string;
  domain: string | null;
  companyName: string;
  crawlEmails: string[];
  leadScore?: number;
  existingContacts: Array<{
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }>;
  phone?: string | null;
};

// ---------------------------------------------------------------------------
// Pattern caching (via SourceEvent table)
// ---------------------------------------------------------------------------

async function getCachedHunterPattern(domain: string): Promise<string | null> {
  const { db } = await import("@/lib/db");
  const event = await db.sourceEvent.findFirst({
    where: {
      provider: SourceProvider.HUNTER,
      eventType: "hunter.domain_search",
      sourceUrl: domain,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!event?.payload) return null;
  const payload = event.payload as Record<string, unknown>;
  return typeof payload.pattern === "string" ? payload.pattern : null;
}

async function cacheHunterResult(
  domain: string,
  pattern: string | null,
  companyId: string,
): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.sourceEvent.create({
    data: {
      companyId,
      provider: SourceProvider.HUNTER,
      eventType: "hunter.domain_search",
      fieldName: "pattern",
      sourceUrl: domain,
      payload: { pattern, searchedAt: new Date().toISOString() },
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contactFromPattern(
  candidate: string,
  pattern: string,
  existingContacts: EmailCascadeInput["existingContacts"],
): NormalizedHunterContact {
  const match = existingContacts.find((c) => {
    const first = c.firstName?.toLowerCase().trim();
    const last = c.lastName?.toLowerCase().trim();
    if (!first || !last) return false;
    let local = pattern;
    local = local.replace(/\{first\}/g, first);
    local = local.replace(/\{last\}/g, last);
    local = local.replace(/\{f\}/g, first.charAt(0));
    local = local.replace(/\{l\}/g, last.charAt(0));
    return local === candidate;
  });

  return {
    email: candidate,
    fullName: match
      ? `${match.firstName ?? ""} ${match.lastName ?? ""}`.trim()
      : candidate.split("@")[0],
    firstName: match?.firstName ?? null,
    lastName: match?.lastName ?? null,
    title: null,
    department: null,
    seniority: null,
    confidence: 50,
  };
}

// ---------------------------------------------------------------------------
// Main cascade orchestrator
// ---------------------------------------------------------------------------

export async function runEmailDiscoveryCascade(
  input: EmailCascadeInput,
): Promise<EmailCascadeResult> {
  const warnings: string[] = [];

  // Step 1: Firecrawl already ran — check if it found emails
  if (input.crawlEmails.length > 0) {
    return {
      source: "firecrawl",
      contactsCreated: input.crawlEmails.length,
      hunterCreditsUsed: 0,
      pattern: null,
      flagForLinkedIn: false,
      warnings,
    };
  }

  // Step 2: Try Hunter.io
  if (input.domain) {
    const cachedPattern = await getCachedHunterPattern(input.domain);

    if (cachedPattern === null) {
      // No cache — need to perform a fresh domain search
      const credits = await getHunterCreditsRemaining();

      if (credits > 0 && (input.leadScore === undefined || input.leadScore >= 60)) {
        try {
          const result = await hunterDomainSearch(input.domain);
          await cacheHunterResult(input.domain, result.pattern, input.companyId);

          if (result.emails.length > 0) {
            const created = await persistContactsFromHunter(input.companyId, result.emails);
            return {
              source: "hunter_search",
              contactsCreated: created,
              hunterCreditsUsed: 1,
              pattern: result.pattern,
              flagForLinkedIn: false,
              warnings,
            };
          }

          if (result.pattern) {
            const localParts = generateCandidateEmails(result.pattern, input.existingContacts);
            const candidates = localParts.map((lp) => `${lp}@${input.domain}`);
            for (const candidate of candidates.slice(0, 2)) {
              const verification = await hunterVerifyEmail(candidate);
              if (verification.status === "valid") {
                const contact = contactFromPattern(candidate, result.pattern, input.existingContacts);
                const created = await persistContactsFromHunter(input.companyId, [contact]);
                return {
                  source: "hunter_pattern",
                  contactsCreated: created,
                  hunterCreditsUsed: 2,
                  pattern: result.pattern,
                  flagForLinkedIn: false,
                  warnings,
                };
              }
            }
            warnings.push("Hunter pattern found but no verified emails generated");
          }
        } catch {
          warnings.push("Hunter domain search failed");
        }
      } else {
        if (credits <= 0) warnings.push("Hunter credits exhausted");
        if (input.leadScore !== undefined && input.leadScore < 60) {
          warnings.push("Lead score below Hunter threshold");
        }
      }
    } else {
      // Have cached pattern — try generating without spending a search credit
      const localParts = generateCandidateEmails(cachedPattern, input.existingContacts);
      const candidates = localParts.map((lp) => `${lp}@${input.domain}`);
      if (candidates.length > 0) {
        const credits = await getHunterCreditsRemaining();
        if (credits >= 1) {
          for (const candidate of candidates.slice(0, 2)) {
            const verification = await hunterVerifyEmail(candidate);
            if (verification.status === "valid") {
              const contact = contactFromPattern(candidate, cachedPattern, input.existingContacts);
              const created = await persistContactsFromHunter(input.companyId, [contact]);
              return {
                source: "hunter_pattern",
                contactsCreated: created,
                hunterCreditsUsed: 1,
                pattern: cachedPattern,
                flagForLinkedIn: false,
                warnings,
              };
            }
          }
        }
      }
    }
  }

  // Step 3: Google Places phone fallback
  if (input.phone) {
    const { db } = await import("@/lib/db");
    const existing = await db.contact.findFirst({
      where: { companyId: input.companyId, phone: input.phone },
    });
    if (!existing) {
      await db.contact.create({
        data: {
          companyId: input.companyId,
          fullName: input.companyName,
          phone: input.phone,
          decisionMakerConfidence: 0.3,
        },
      });
    }
    return {
      source: "google_places_phone",
      contactsCreated: existing ? 0 : 1,
      hunterCreditsUsed: 0,
      pattern: null,
      flagForLinkedIn: true,
      warnings,
    };
  }

  // Nothing found
  return {
    source: "none",
    contactsCreated: 0,
    hunterCreditsUsed: 0,
    pattern: null,
    flagForLinkedIn: true,
    warnings: [...warnings, "No email discovery source available"],
  };
}
