import {
  buildDealNoteBody,
  buildDealProperties,
  mapLeadStateToDealStage,
} from "@/lib/domain/hubspot-lifecycle";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

type FetchLike = typeof fetch;

type HubSpotEnv = NodeJS.ProcessEnv;

type HubSpotCompanyInput = {
  id?: string;
  name: string;
  website?: string | null;
  normalizedDomain?: string | null;
  phone?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  description?: string | null;
};

type HubSpotContactInput = {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
};

type HubSpotDraftInput = {
  id: string;
  emailSubject1: string;
  draftType: string;
  sequenceStep: number;
};

type HubSpotEngagementEventInput = {
  id: string;
  eventType: string;
  occurredAt: Date;
  payload?: unknown;
};

export type HubSpotMirrorInput = {
  company: HubSpotCompanyInput;
  contact?: HubSpotContactInput;
  draft: HubSpotDraftInput;
  event?: HubSpotEngagementEventInput | null;
};

export type HubSpotMirrorResult =
  | {
      mirrored: false;
      skipped: true;
      reason: string;
    }
  | {
      mirrored: true;
      companyId: string;
      companyCreated: boolean;
      contactId?: string;
      contactCreated?: boolean;
      noteId?: string;
    };

type HubSpotSearchPayload = {
  filterGroups: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value: string;
    }>;
  }>;
  limit: number;
  properties: string[];
};

type HubSpotCreatePayload = {
  properties: Record<string, string>;
};

type HubSpotNotePayload = {
  properties: {
    hs_note_body: string;
  };
};

function getHubSpotToken(env: HubSpotEnv = process.env) {
  return env.HUBSPOT_PRIVATE_APP_TOKEN?.trim() || null;
}

export function isHubSpotConfigured(env: HubSpotEnv = process.env) {
  return Boolean(getHubSpotToken(env));
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry != null && entry !== ""),
  ) as Partial<T>;
}

function normalizeDomain(company: HubSpotCompanyInput) {
  if (company.normalizedDomain) {
    return company.normalizedDomain;
  }

  if (!company.website) {
    return null;
  }

  try {
    return new URL(company.website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function splitFullName(contact: HubSpotContactInput) {
  if (contact.firstName || contact.lastName) {
    return {
      firstName: contact.firstName ?? undefined,
      lastName: contact.lastName ?? undefined,
    };
  }

  const name = contact.fullName?.trim();

  if (!name) {
    return {};
  }

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: parts[0],
    };
  }

  return {
    firstName: parts.shift(),
    lastName: parts.join(" "),
  };
}

async function fetchHubSpotJson<T>(
  fetchImpl: FetchLike,
  path: string,
  init: RequestInit,
  env: HubSpotEnv = process.env,
) {
  const token = getHubSpotToken(env);

  if (!token) {
    throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not configured.");
  }

  const response = await fetchImpl(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data && typeof data.message === "string"
        ? data.message
        : `HubSpot request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return data as T;
}

export function buildHubSpotCompanySearchPayload(company: {
  name: string;
  normalizedDomain?: string | null;
}) {
  const domain = normalizeDomain(company);

  return {
    filterGroups: [
      {
        filters: [
          domain
            ? {
                propertyName: "domain",
                operator: "EQ",
                value: domain,
              }
            : {
                propertyName: "name",
                operator: "CONTAINS_TOKEN",
                value: company.name,
              },
        ],
      },
    ],
    limit: 1,
    properties: ["name", "domain", "website", "phone", "industry"],
  } satisfies HubSpotSearchPayload;
}

export function buildHubSpotCompanyUpsertPayload(company: HubSpotCompanyInput) {
  return {
    properties: compactObject({
      name: company.name,
      domain: normalizeDomain(company) ?? undefined,
      website: company.website ?? undefined,
      phone: company.phone ?? undefined,
      industry: company.industry ?? undefined,
      numberofemployees:
        company.employeeCount != null ? String(company.employeeCount) : undefined,
      description: company.description ?? undefined,
    }),
  } satisfies HubSpotCreatePayload;
}

export function buildHubSpotContactSearchPayload(contact: { email: string }) {
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "email",
            operator: "EQ",
            value: contact.email,
          },
        ],
      },
    ],
    limit: 1,
    properties: ["email", "firstname", "lastname", "jobtitle", "phone"],
  } satisfies HubSpotSearchPayload;
}

export function buildHubSpotContactUpsertPayload(contact: HubSpotContactInput) {
  const nameParts = splitFullName(contact);

  return {
    properties: compactObject({
      email: contact.email ?? undefined,
      firstname: nameParts.firstName,
      lastname: nameParts.lastName,
      jobtitle: contact.title ?? undefined,
      phone: contact.phone ?? undefined,
    }),
  } satisfies HubSpotCreatePayload;
}

export function buildHubSpotEngagementNotePayload(input: {
  draft: HubSpotDraftInput;
  company: HubSpotCompanyInput;
  contact?: HubSpotContactInput;
  event?: HubSpotEngagementEventInput | null;
}) {
  const contactLabel = input.contact?.fullName
    ? input.contact.email
      ? `${input.contact.fullName} <${input.contact.email}>`
      : input.contact.fullName
    : input.contact?.email ?? "not available";

  const sections = [
    "Outreach mirror from Lead Intelligence Engine",
    `Company: ${input.company.name}`,
    `Contact: ${contactLabel}`,
    `Draft: ${input.draft.id} (${input.draft.draftType}, step ${input.draft.sequenceStep})`,
    `Subject: ${input.draft.emailSubject1}`,
  ];

  if (input.event) {
    sections.push(
      `Event: ${input.event.eventType}`,
      `Occurred at: ${input.event.occurredAt.toISOString()}`,
    );

    if (input.event.payload != null) {
      sections.push(`Payload: ${JSON.stringify(input.event.payload, null, 2)}`);
    }
  } else {
    sections.push("Event: no engagement event was available");
  }

  return {
    properties: {
      hs_note_body: sections.join("\n\n"),
    },
  } satisfies HubSpotNotePayload;
}

async function searchHubSpotObject<T extends { id: string }>(
  fetchImpl: FetchLike,
  path: string,
  payload: HubSpotSearchPayload,
  env: HubSpotEnv,
) {
  const result = await fetchHubSpotJson<{ results?: T[] }>(
    fetchImpl,
    path,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    env,
  );

  return result?.results?.[0] ?? null;
}

async function upsertHubSpotObject(
  fetchImpl: FetchLike,
  env: HubSpotEnv,
  options: {
    searchPath: string;
    searchPayload: HubSpotSearchPayload;
    createPath: string;
    updatePath: (id: string) => string;
    createPayload: HubSpotCreatePayload;
    updatePayload?: HubSpotCreatePayload;
  },
) {
  const existing = await searchHubSpotObject<{ id: string }>(
    fetchImpl,
    options.searchPath,
    options.searchPayload,
    env,
  );

  if (existing?.id) {
    await fetchHubSpotJson(
      fetchImpl,
      options.updatePath(existing.id),
      {
        method: "PATCH",
        body: JSON.stringify(options.updatePayload ?? options.createPayload),
      },
      env,
    );

    return {
      id: existing.id,
      created: false,
    };
  }

  const created = await fetchHubSpotJson<{ id?: string }>(
    fetchImpl,
    options.createPath,
    {
      method: "POST",
      body: JSON.stringify(options.createPayload),
    },
    env,
  );

  if (!created?.id) {
    throw new Error("HubSpot create response did not include an id.");
  }

  return {
    id: created.id,
    created: true,
  };
}

export async function syncOutreachDraftToHubSpot(
  input: HubSpotMirrorInput,
  options: {
    env?: HubSpotEnv;
    fetchImpl?: FetchLike;
  } = {},
): Promise<HubSpotMirrorResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!isHubSpotConfigured(env)) {
    return {
      mirrored: false,
      skipped: true,
      reason: "HUBSPOT_PRIVATE_APP_TOKEN is not configured.",
    };
  }

  const company = await upsertHubSpotObject(fetchImpl, env, {
    searchPath: "/crm/v3/objects/companies/search",
    searchPayload: buildHubSpotCompanySearchPayload(input.company),
    createPath: "/crm/v3/objects/companies",
    updatePath: (id) => `/crm/v3/objects/companies/${id}`,
    createPayload: buildHubSpotCompanyUpsertPayload(input.company),
  });

  let contactId: string | undefined;
  let contactCreated: boolean | undefined;

  if (input.contact?.email) {
    const contact = await upsertHubSpotObject(fetchImpl, env, {
      searchPath: "/crm/v3/objects/contacts/search",
      searchPayload: buildHubSpotContactSearchPayload({
        email: input.contact.email,
      }),
      createPath: "/crm/v3/objects/contacts",
      updatePath: (id) => `/crm/v3/objects/contacts/${id}`,
      createPayload: buildHubSpotContactUpsertPayload(input.contact),
    });

    contactId = contact.id || undefined;
    contactCreated = contact.created;

    if (company.id && contactId) {
      await fetchHubSpotJson(
        fetchImpl,
        `/crm/v4/objects/contact/${contactId}/associations/default/company/${company.id}`,
        {
          method: "PUT",
        },
        env,
      );
    }
  }

  const note = await fetchHubSpotJson<{ id?: string }>(
    fetchImpl,
    "/crm/v3/objects/notes",
    {
      method: "POST",
      body: JSON.stringify(
        buildHubSpotEngagementNotePayload({
          draft: input.draft,
          company: input.company,
          contact: input.contact,
          event: input.event ?? null,
        }),
      ),
    },
    env,
  );

  const noteId = note?.id;

  if (noteId && company.id) {
    await fetchHubSpotJson(
      fetchImpl,
      `/crm/v4/objects/notes/${noteId}/associations/default/company/${company.id}`,
      {
        method: "PUT",
      },
      env,
    );
  }

  if (noteId && contactId) {
    await fetchHubSpotJson(
      fetchImpl,
      `/crm/v4/objects/notes/${noteId}/associations/default/contact/${contactId}`,
      {
        method: "PUT",
      },
      env,
    );
  }

  return {
    mirrored: true,
    companyId: company.id,
    companyCreated: company.created,
    contactId,
    contactCreated,
    noteId,
  };
}

export async function upsertHubSpotDeal(
  input: {
    companyName: string;
    companyHubSpotId: string;
    contactHubSpotId?: string;
    dealProperties: Record<string, string>;
  },
  options: {
    env?: HubSpotEnv;
    fetchImpl?: FetchLike;
  } = {},
): Promise<{ dealId: string; created: boolean }> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  const deal = await upsertHubSpotObject(fetchImpl, env, {
    searchPath: "/crm/v3/objects/deals/search",
    searchPayload: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "dealname",
              operator: "EQ",
              value: `Outreach: ${input.companyName}`,
            },
          ],
        },
      ],
      limit: 1,
      properties: ["dealname", "dealstage", "pipeline"],
    },
    createPath: "/crm/v3/objects/deals",
    updatePath: (id) => `/crm/v3/objects/deals/${id}`,
    createPayload: { properties: input.dealProperties },
  });

  await fetchHubSpotJson(
    fetchImpl,
    `/crm/v4/objects/deal/${deal.id}/associations/default/company/${input.companyHubSpotId}`,
    { method: "PUT" },
    env,
  );

  if (input.contactHubSpotId) {
    await fetchHubSpotJson(
      fetchImpl,
      `/crm/v4/objects/deal/${deal.id}/associations/default/contact/${input.contactHubSpotId}`,
      { method: "PUT" },
      env,
    );
  }

  return { dealId: deal.id, created: deal.created };
}

export type ProgressHubSpotDealStageResult =
  | { dealId: string; noteId?: string }
  | { skipped: true; reason: string };

export async function progressHubSpotDealStage(
  input: {
    company: {
      name: string;
      website?: string | null;
      normalizedDomain?: string | null;
      phone?: string | null;
      industry?: string | null;
      employeeCount?: number | null;
      description?: string | null;
    };
    contact?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
    stage: string;
    context: {
      leadScore?: number | null;
      painSummary?: string | null;
      confidence?: number | null;
      outreachStatus?: string | null;
      replyClassification?: string | null;
      leadMagnetUsed?: string | null;
      recommendedChannel?: string | null;
    };
  },
  options: {
    env?: HubSpotEnv;
    fetchImpl?: FetchLike;
  } = {},
): Promise<ProgressHubSpotDealStageResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!isHubSpotConfigured(env)) {
    return {
      skipped: true,
      reason: "HUBSPOT_PRIVATE_APP_TOKEN is not configured.",
    };
  }

  const dealStage = mapLeadStateToDealStage(input.stage);

  const company = await upsertHubSpotObject(fetchImpl, env, {
    searchPath: "/crm/v3/objects/companies/search",
    searchPayload: buildHubSpotCompanySearchPayload(input.company),
    createPath: "/crm/v3/objects/companies",
    updatePath: (id) => `/crm/v3/objects/companies/${id}`,
    createPayload: buildHubSpotCompanyUpsertPayload(input.company),
  });

  let contactHubSpotId: string | undefined;

  if (input.contact?.email) {
    const contact = await upsertHubSpotObject(fetchImpl, env, {
      searchPath: "/crm/v3/objects/contacts/search",
      searchPayload: buildHubSpotContactSearchPayload({ email: input.contact.email }),
      createPath: "/crm/v3/objects/contacts",
      updatePath: (id) => `/crm/v3/objects/contacts/${id}`,
      createPayload: buildHubSpotContactUpsertPayload({
        email: input.contact.email,
        fullName: input.contact.fullName ?? undefined,
      }),
    });

    contactHubSpotId = contact.id || undefined;
  }

  const dealProperties = buildDealProperties({
    companyName: input.company.name,
    stage: dealStage,
    ...input.context,
  });

  const { dealId } = await upsertHubSpotDeal(
    {
      companyName: input.company.name,
      companyHubSpotId: company.id,
      contactHubSpotId,
      dealProperties,
    },
    { env, fetchImpl },
  );

  const noteBody = buildDealNoteBody({
    companyName: input.company.name,
    stage: dealStage,
    ...input.context,
  });

  const note = await fetchHubSpotJson<{ id?: string }>(
    fetchImpl,
    "/crm/v3/objects/notes",
    {
      method: "POST",
      body: JSON.stringify({ properties: { hs_note_body: noteBody } }),
    },
    env,
  );

  const noteId = note?.id;

  if (noteId) {
    await fetchHubSpotJson(
      fetchImpl,
      `/crm/v4/objects/notes/${noteId}/associations/default/deal/${dealId}`,
      { method: "PUT" },
      env,
    );
  }

  return { dealId, noteId };
}
