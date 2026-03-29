import {
  extractLeadWebsitePages,
  normalizeFirecrawlPage,
  selectFirecrawlCandidatePages,
} from "@/lib/providers/firecrawl/client";

describe("selectFirecrawlCandidatePages", () => {
  it("keeps only the relevant public business pages", () => {
    const pages = selectFirecrawlCandidatePages("https://atlasdental.co.za", [
      "https://atlasdental.co.za/",
      "https://atlasdental.co.za/about",
      "https://atlasdental.co.za/services",
      "https://atlasdental.co.za/blog/new-smile-guide",
      "https://atlasdental.co.za/login",
      "https://facebook.com/atlasdental",
    ]);

    expect(pages.map((page) => page.pageType)).toEqual([
      "HOMEPAGE",
      "ABOUT",
      "SERVICES",
      "BLOG",
    ]);
  });
});

describe("normalizeFirecrawlPage", () => {
  it("maps a scrape response into a crawl page record", () => {
    const normalized = normalizeFirecrawlPage(
      {
        pageType: "ABOUT",
        url: "https://atlasdental.co.za/about",
      },
      {
        data: {
          markdown: "Atlas Dental Group provides family and cosmetic dentistry.",
          metadata: {
            title: "About Atlas Dental Group",
          },
        },
      },
    );

    expect(normalized).toMatchObject({
      pageType: "ABOUT",
      title: "About Atlas Dental Group",
    });
    expect(normalized.confidence).toBeGreaterThan(0.7);
  });
});

describe("extractLeadWebsitePages", () => {
  it("throws when the Firecrawl API key is missing", async () => {
    await expect(
      extractLeadWebsitePages(
        {
          website: "https://atlasdental.co.za",
        },
        {
          apiKey: "",
          fetchFn: vi.fn(),
        },
      ),
    ).rejects.toThrow(/firecrawl api key/i);
  });
});
