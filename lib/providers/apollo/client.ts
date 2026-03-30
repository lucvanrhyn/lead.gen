import {
  EnrichmentStage,
  JobStatus,
  SourceProvider,
} from "@prisma/client";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";
const DEFAULT_TITLE_HINTS = [
  "owner",
  "founder",
  "chief executive officer",
  "managing director",
  "practice manager",
  "operations manager",
  "marketing manager",
];

type FetchLike = typeof fetch;

type ApolloErrorPayload = {
  error?: string;
  error_code?: string;
};

type ApolloOrganizationPayload = {
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    phone?: string;
    primary_domain?: string;
    industry?: string;
    estimated_num_employees?: number;
    short_description?: string;
    city?: string;
    country?: string;
  };
};

type ApolloPerson = {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  departments?: string[];
  seniority?: string;
  phone_numbers?: Array<{
    raw_number?: string;
  }>;
};

export type NormalizedApolloCompany = {
  apolloOrganizationId?: string;
  name: string;
  website?: string;
  normalizedDomain?: string;
  phone?: string;
  industry?: string;
  employeeCount?: number;
  description?: string;
  locationSummary?: string;
  confidence: number;
  raw: ApolloOrganizationPayload;
};

export type NormalizedApolloContact = {
  apolloPersonId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  department?: string;
  seniority?: string;
  decisionMakerConfidence: number;
  raw: ApolloPerson;
};

class ApolloApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = "ApolloApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

function getApolloApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.APOLLO_API_KEY;

  if (!resolved) {
    throw new Error("Apollo API key is required for Apollo enrichment.");
  }

  return resolved;
}

async function fetchApolloJson(
  url: string,
  init: RequestInit,
  fetchFn: FetchLike,
  attempts = 3,
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchFn(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": init.headers && "x-api-key" in init.headers ? init.headers["x-api-key"] : "",
        ...init.headers,
      },
    });

    if (response.ok) {
      return response.json();
    }

    const errorPayload = (await response.json().catch(() => ({}))) as ApolloErrorPayload;
    const errorMessage =
      errorPayload.error ?? `Apollo request failed with status ${response.status}.`;

    if (response.status === 429 || response.status >= 500) {
      lastError = new ApolloApiError(errorMessage, response.status, errorPayload.error_code);
      continue;
    }

    throw new ApolloApiError(errorMessage, response.status, errorPayload.error_code);
  }

  throw lastError ?? new Error("Apollo request failed after retries.");
}

function isApolloPeoplePlanRestriction(error: unknown) {
  return (
    error instanceof ApolloApiError &&
    error.status === 403 &&
    error.errorCode === "API_INACCESSIBLE"
  );
}

export function normalizeApolloOrganization(
  payload: ApolloOrganizationPayload,
): NormalizedApolloCompany {
  const organization = payload.organization ?? {};
  const completenessSignals = [
    organization.id,
    organization.website_url,
    organization.phone,
    organization.industry,
    organization.estimated_num_employees,
    organization.short_description,
  ].filter(Boolean).length;

  return {
    apolloOrganizationId: organization.id,
    name: organization.name ?? "Unknown company",
    website: organization.website_url,
    normalizedDomain:
      organization.primary_domain ??
      organization.website_url?.replace(/^https?:\/\//, "").replace(/^www\./, ""),
    phone: organization.phone,
    industry: organization.industry,
    employeeCount: organization.estimated_num_employees,
    description: organization.short_description,
    locationSummary: [organization.city, organization.country].filter(Boolean).join(", "),
    confidence: Number(Math.min(0.95, 0.45 + completenessSignals * 0.08).toFixed(2)),
    raw: payload,
  };
}

function normalizeApolloContact(person: ApolloPerson): NormalizedApolloContact {
  const completenessSignals = [
    person.id,
    person.title,
    person.email,
    person.phone_numbers?.[0]?.raw_number,
    person.seniority,
  ].filter(Boolean).length;

  return {
    apolloPersonId: person.id,
    fullName:
      person.name ??
      [person.first_name, person.last_name].filter(Boolean).join(" ") ??
      "Unknown contact",
    firstName: person.first_name,
    lastName: person.last_name,
    title: person.title,
    email: person.email,
    phone: person.phone_numbers?.[0]?.raw_number,
    department: person.departments?.[0],
    seniority: person.seniority,
    decisionMakerConfidence: Number(
      Math.min(0.95, 0.5 + completenessSignals * 0.08).toFixed(2),
    ),
    raw: person,
  };
}

async function fetchApolloOrganization(
  domain: string,
  apiKey: string,
  fetchFn: FetchLike,
) {
  const url = new URL(`${APOLLO_BASE_URL}/organizations/enrich`);
  url.searchParams.set("domain", domain);

  return fetchApolloJson(
    url.toString(),
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    },
    fetchFn,
  ) as Promise<ApolloOrganizationPayload>;
}

async function searchApolloPeople(
  domain: string,
  apiKey: string,
  fetchFn: FetchLike,
) {
  return fetchApolloJson(
    `${APOLLO_BASE_URL}/mixed_people/api_search`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        q_organization_domains_list: [domain],
        person_titles: DEFAULT_TITLE_HINTS,
        page: 1,
        per_page: 5,
      }),
    },
    fetchFn,
  ) as Promise<{ people?: ApolloPerson[] }>;
}

async function bulkMatchApolloPeople(
  people: ApolloPerson[],
  domain: string,
  apiKey: string,
  fetchFn: FetchLike,
) {
  return fetchApolloJson(
    `${APOLLO_BASE_URL}/people/bulk_match`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        details: people.map((person) => ({
          id: person.id,
          email: person.email,
          first_name: person.first_name,
          last_name: person.last_name,
          name: person.name,
          organization_domain: domain,
        })),
      }),
    },
    fetchFn,
  ) as Promise<{ people?: ApolloPerson[] }>;
}

export async function enrichApolloCompanyAndContacts(
  input: {
    domain: string;
    companyName?: string;
    persistCompanyId?: string;
  },
  options?: {
    apiKey?: string;
    fetchFn?: FetchLike;
    persist?: boolean;
  },
) {
  const apiKey = getApolloApiKey(options?.apiKey);
  const fetchFn = options?.fetchFn ?? fetch;

  const organizationPayload = await fetchApolloOrganization(input.domain, apiKey, fetchFn);
  const company = normalizeApolloOrganization(organizationPayload);
  const warnings: string[] = [];
  let contacts: NormalizedApolloContact[] = [];

  try {
    const peopleSearchPayload = await searchApolloPeople(input.domain, apiKey, fetchFn);
    const matchedPeoplePayload = await bulkMatchApolloPeople(
      peopleSearchPayload.people ?? [],
      input.domain,
      apiKey,
      fetchFn,
    );

    contacts = (matchedPeoplePayload.people ?? []).map(normalizeApolloContact);
  } catch (error) {
    if (!isApolloPeoplePlanRestriction(error)) {
      throw error;
    }

    warnings.push("Apollo people search is unavailable for the current Apollo API plan.");
  }

  if (options?.persist !== false && input.persistCompanyId) {
    await persistApolloEnrichment(input.persistCompanyId, company, contacts, warnings);
  }

  return {
    company,
    contacts,
    warnings,
  };
}

export async function persistApolloEnrichment(
  companyId: string,
  company: NormalizedApolloCompany,
  contacts: NormalizedApolloContact[],
  warnings: string[] = [],
) {
  const { db } = await import("@/lib/db");

  await db.company.update({
    where: { id: companyId },
    data: {
      name: company.name,
      website: company.website,
      phone: company.phone,
      normalizedDomain: company.normalizedDomain,
      industry: company.industry,
      employeeCount: company.employeeCount,
      description: company.description,
      locationSummary: company.locationSummary || undefined,
      apolloOrganizationId: company.apolloOrganizationId,
      sourceConfidence: company.confidence,
    },
  });

  await db.sourceEvent.create({
    data: {
      companyId,
      provider: SourceProvider.APOLLO,
      eventType: "apollo.company_enrichment",
      fieldName: "company.profile",
      sourceUrl: company.website,
      confidence: company.confidence,
      payload: company.raw,
    },
  });

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.APOLLO,
      stage: EnrichmentStage.APOLLO_COMPANY_ENRICHMENT,
      status: JobStatus.SUCCEEDED,
      attempts: 1,
      requestedBy: "api.leads.enrich",
      resultSummary: {
        apollo_organization_id: company.apolloOrganizationId,
        contact_count: contacts.length,
      },
    },
  });

  for (const contact of contacts) {
    const persistedContact = contact.apolloPersonId
      ? await db.contact.upsert({
          where: {
            apolloPersonId: contact.apolloPersonId,
          },
          create: {
            companyId,
            fullName: contact.fullName,
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            email: contact.email,
            phone: contact.phone,
            department: contact.department,
            seniority: contact.seniority,
            apolloPersonId: contact.apolloPersonId,
            decisionMakerConfidence: contact.decisionMakerConfidence,
          },
          update: {
            fullName: contact.fullName,
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            email: contact.email,
            phone: contact.phone,
            department: contact.department,
            seniority: contact.seniority,
            decisionMakerConfidence: contact.decisionMakerConfidence,
          },
        })
      : await db.contact.create({
          data: {
            companyId,
            fullName: contact.fullName,
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            email: contact.email,
            phone: contact.phone,
            department: contact.department,
            seniority: contact.seniority,
            decisionMakerConfidence: contact.decisionMakerConfidence,
          },
        });

    await db.sourceEvent.create({
      data: {
        companyId,
        contactId: persistedContact.id,
        provider: SourceProvider.APOLLO,
        eventType: "apollo.people_enrichment",
        fieldName: "contact.profile",
        sourceUrl: company.website,
        confidence: contact.decisionMakerConfidence,
        payload: contact.raw,
      },
    });
  }

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.APOLLO,
      stage: EnrichmentStage.APOLLO_PEOPLE_ENRICHMENT,
      status: contacts.length > 0 ? JobStatus.SUCCEEDED : JobStatus.PARTIAL,
      attempts: 1,
      requestedBy: "api.leads.enrich",
      lastError: warnings[0] ?? null,
      resultSummary: {
        contact_count: contacts.length,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    },
  });
}
