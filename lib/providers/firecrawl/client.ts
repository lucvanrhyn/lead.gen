import {
  CrawlPageType,
  EnrichmentStage,
  JobStatus,
  SourceProvider,
} from "@prisma/client";

const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v2/map";
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const EXCLUDED_PATH_SEGMENTS = ["login", "signin", "checkout", "cart", "account", "privacy"];

type FetchLike = typeof fetch;

type FirecrawlPageSelection = {
  pageType: keyof typeof CrawlPageType;
  url: string;
};

type FirecrawlScrapeResponse = {
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
    };
  };
};

export type NormalizedFirecrawlPage = {
  pageType: keyof typeof CrawlPageType;
  url: string;
  title?: string;
  markdown?: string;
  confidence: number;
  raw: FirecrawlScrapeResponse;
};

function getFirecrawlApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.FIRECRAWL_API_KEY;

  if (!resolved) {
    throw new Error("Firecrawl API key is required for website extraction.");
  }

  return resolved;
}

async function fetchFirecrawlJson(
  url: string,
  init: RequestInit,
  fetchFn: FetchLike,
  attempts = 3,
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchFn(url, init);

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`Firecrawl request failed with status ${response.status}.`);
      continue;
    }

    throw new Error(`Firecrawl request failed with status ${response.status}.`);
  }

  throw lastError ?? new Error("Firecrawl request failed after retries.");
}

function classifyPageType(pathname: string) {
  const normalizedPath = pathname.toLowerCase();

  if (normalizedPath === "/" || normalizedPath === "") return "HOMEPAGE";
  if (normalizedPath.includes("about")) return "ABOUT";
  if (normalizedPath.includes("service")) return "SERVICES";
  if (normalizedPath.includes("contact")) return "CONTACT";
  if (normalizedPath.includes("pricing") || normalizedPath.includes("price")) return "PRICING";
  if (normalizedPath.includes("blog")) return "BLOG";
  if (normalizedPath.includes("news")) return "NEWS";
  if (normalizedPath.includes("review") || normalizedPath.includes("testimonial")) return "REVIEWS";

  return null;
}

export function selectFirecrawlCandidatePages(baseUrl: string, mappedUrls: string[]) {
  const base = new URL(baseUrl);
  const selected = new Map<string, FirecrawlPageSelection>();

  for (const candidateUrl of mappedUrls) {
    const parsed = new URL(candidateUrl);

    if (parsed.origin !== base.origin) {
      continue;
    }

    if (EXCLUDED_PATH_SEGMENTS.some((segment) => parsed.pathname.toLowerCase().includes(segment))) {
      continue;
    }

    const pageType = classifyPageType(parsed.pathname);

    if (!pageType) {
      continue;
    }

    if (!selected.has(pageType)) {
      selected.set(pageType, {
        pageType,
        url: parsed.toString(),
      });
    }
  }

  if (!selected.has("HOMEPAGE")) {
    selected.set("HOMEPAGE", {
      pageType: "HOMEPAGE",
      url: base.toString(),
    });
  }

  return Array.from(selected.values());
}

export function normalizeFirecrawlPage(
  selection: FirecrawlPageSelection,
  response: FirecrawlScrapeResponse,
): NormalizedFirecrawlPage {
  const markdown = response.data?.markdown;
  const title = response.data?.metadata?.title;
  const completenessSignals = [markdown, title].filter(Boolean).length;

  return {
    pageType: selection.pageType,
    url: selection.url,
    title,
    markdown,
    confidence: Number(Math.min(0.95, 0.55 + completenessSignals * 0.15).toFixed(2)),
    raw: response,
  };
}

async function mapWebsitePages(
  website: string,
  apiKey: string,
  fetchFn: FetchLike,
) {
  return fetchFirecrawlJson(
    FIRECRAWL_MAP_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: website,
        limit: 25,
      }),
    },
    fetchFn,
  ) as Promise<{ links?: string[] }>;
}

async function scrapePage(
  selection: FirecrawlPageSelection,
  apiKey: string,
  fetchFn: FetchLike,
) {
  const response = (await fetchFirecrawlJson(
    FIRECRAWL_SCRAPE_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: selection.url,
        formats: ["markdown"],
      }),
    },
    fetchFn,
  )) as FirecrawlScrapeResponse;

  return normalizeFirecrawlPage(selection, response);
}

export async function extractLeadWebsitePages(
  input: {
    website: string;
    persistCompanyId?: string;
  },
  options?: {
    apiKey?: string;
    fetchFn?: FetchLike;
    persist?: boolean;
  },
) {
  const apiKey = getFirecrawlApiKey(options?.apiKey);
  const fetchFn = options?.fetchFn ?? fetch;
  const mapResponse = await mapWebsitePages(input.website, apiKey, fetchFn);
  const selections = selectFirecrawlCandidatePages(input.website, mapResponse.links ?? [input.website]);

  const pages = await Promise.all(
    selections.map((selection) => scrapePage(selection, apiKey, fetchFn)),
  );

  if (options?.persist !== false && input.persistCompanyId) {
    await persistFirecrawlPages(input.persistCompanyId, pages);
  }

  return {
    provider: "firecrawl",
    pages,
  };
}

export async function persistFirecrawlPages(
  companyId: string,
  pages: NormalizedFirecrawlPage[],
) {
  const { db } = await import("@/lib/db");

  await db.crawlPage.deleteMany({
    where: { companyId },
  });

  for (const page of pages) {
    await db.crawlPage.create({
      data: {
        companyId,
        provider: SourceProvider.FIRECRAWL,
        pageType: CrawlPageType[page.pageType],
        url: page.url,
        title: page.title,
        markdown: page.markdown,
        confidence: page.confidence,
        extractedAt: new Date(),
        rawPayload: page.raw,
      },
    });

    await db.sourceEvent.create({
      data: {
        companyId,
        provider: SourceProvider.FIRECRAWL,
        eventType: "firecrawl.page_extraction",
        fieldName: `crawl_pages.${page.pageType.toLowerCase()}`,
        sourceUrl: page.url,
        confidence: page.confidence,
        payload: page.raw,
      },
    });
  }

  await db.enrichmentJob.create({
    data: {
      companyId,
      provider: SourceProvider.FIRECRAWL,
      stage: EnrichmentStage.FIRECRAWL_EXTRACTION,
      status: pages.length > 0 ? JobStatus.SUCCEEDED : JobStatus.PARTIAL,
      attempts: 1,
      requestedBy: "api.leads.crawl",
      resultSummary: {
        page_count: pages.length,
      },
    },
  });
}
