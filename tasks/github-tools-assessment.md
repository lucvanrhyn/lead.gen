# GitHub Tools Assessment

Assessment of two open-source tools for potential integration into the lead generation pipeline.

---

## 1. reacherhq/check-if-email-exists (8.5k stars)

### What it does
Self-hosted email verification that checks whether an email address exists by performing:
- DNS MX record lookup
- SMTP connection and RCPT TO verification
- Catch-all detection
- Disposable email detection (built-in)
- Gravatar check

### How it works
- **Core:** Written in Rust as a library (`check-if-email-exists` crate)
- **Binary:** Provides a CLI binary and an HTTP backend server (`backend` feature)
- **Docker:** Official Docker image at `reacherhq/backend` that exposes an HTTP API on port 8080
- **No npm package:** There is no native Node.js binding. The only integration path is via HTTP API or CLI subprocess.

### Integration approach for our stack

**Option A: Docker sidecar (recommended)**
1. Run `docker run -p 8080:8080 reacherhq/backend` alongside the Next.js app
2. Call `POST http://localhost:8080/v0/check_email` with `{ "to_email": "test@example.com" }`
3. Response includes `is_reachable` (safe/risky/invalid/unknown), MX records, SMTP details
4. Create `lib/providers/reacher/client.ts` wrapping the HTTP calls

**Option B: Vercel-compatible approach**
- Cannot run a Rust binary on Vercel Hobby plan (serverless functions only)
- Would need a separate always-on server (e.g., a $5/mo DigitalOcean droplet or Railway)
- Alternatively, Reacher offers a hosted SaaS at https://reacher.email with API access (paid)

**Deployment considerations:**
- SMTP verification requires a server with a clean IP (not blocked by email providers)
- Vercel/cloud function IPs are commonly blocked by SMTP servers, making verification unreliable
- A dedicated VPS with a static IP is strongly recommended for SMTP checks
- Yahoo, Microsoft, and some Gmail servers block automated SMTP verification entirely

### Effort estimate
- Docker setup + client wrapper: 2-3 hours
- VPS provisioning + deployment: 2-4 hours
- Integration into email cascade as a verification step: 1-2 hours
- **Total: 5-9 hours**

### Recommendation: **Integrate later**

**Rationale:**
- Strong value proposition: could replace Hunter.io verification entirely (free, unlimited)
- However, requires a separate always-on server, which adds infrastructure complexity
- SMTP verification from cloud IPs is unreliable; needs a dedicated VPS
- Current Hunter.io free tier is sufficient for the ~100 leads/day target
- Worth setting up when Hunter.io credits become a bottleneck or when scaling beyond free tier

**When to pull the trigger:**
- Hunter.io credits consistently exhausted before month end
- Need to verify emails from sources other than Hunter (e.g., crawl-extracted emails)
- Scaling beyond 100 leads/day

---

## 2. omkarcloud/google-maps-scraper (2.5k stars)

### What it does
A Python-based scraper that extracts 50+ data points per business from Google Maps, including:
- Business name, address, phone, website, hours
- Emails (scraped from website)
- Reviews, ratings, category
- Social media links
- Owner/manager information (when available)

### How it works
- **Language:** Python 3 with Selenium/Playwright for browser automation
- **Execution:** Runs locally or in Docker via `python main.py`
- **Input:** Search queries (e.g., "restaurants in Austin TX")
- **Output:** CSV/JSON files with extracted data
- **Rate limiting:** Built-in delays to avoid Google detection
- **No API:** No HTTP API exposed; it is a batch CLI tool

### Integration approach for our stack

**Option A: Batch pre-processing (recommended)**
1. Run the scraper as a scheduled batch job (cron or manual)
2. Output results to a shared directory or S3 bucket as JSON
3. Create an import endpoint `POST /api/discovery/import-gmaps` that reads the JSON and creates Company + Contact records in the database
4. This supplements (not replaces) Google Places API for discovery

**Option B: Python microservice**
1. Wrap the scraper in a Flask/FastAPI HTTP API
2. Call it from Next.js via HTTP
3. Higher complexity, requires a separate server

**Option C: Node.js subprocess**
1. Shell out to the Python script from Node.js
2. Parse the output JSON
3. Fragile; not recommended for production

### Comparison with current Google Places API

| Feature | Google Places API | Google Maps Scraper |
|---------|------------------|-------------------|
| Cost | $17/1000 requests | Free |
| Emails | No | Yes (scraped from website) |
| Phone | Yes | Yes |
| Reviews | Limited | Full |
| Rate limit | API quota | Browser-based, slower |
| Reliability | High (official API) | Medium (scraping, may break) |
| Legal risk | None | Gray area (ToS violation) |
| Speed | Fast (~200ms) | Slow (~5-10s per business) |

### Effort estimate
- Docker setup + batch runner: 2-3 hours
- Import endpoint: 2-3 hours
- Data mapping (scraper schema -> Prisma schema): 1-2 hours
- Testing + edge cases: 2-3 hours
- **Total: 7-11 hours**

### Recommendation: **Skip for now**

**Rationale:**
- Google Maps scraping violates Google's Terms of Service; legal risk for a business tool
- Scraping is inherently brittle; Google frequently changes their DOM structure
- The scraper is slow (5-10s per business) compared to Places API (~200ms)
- Current stack already has Google Places API for discovery + Firecrawl for email extraction
- The email extraction from the scraper overlaps with what Firecrawl already does
- Adding a Python dependency to a Node.js/Next.js stack increases maintenance burden

**When to reconsider:**
- If Google Places API costs become prohibitive at scale
- If a legal review confirms acceptable risk for the specific use case
- If the project pivots to a market where official APIs have poor coverage

---

## Summary

| Tool | Stars | Action | Priority | Effort |
|------|-------|--------|----------|--------|
| disposable-email-domains | 4.9k | **Implemented** | Immediate | Done |
| reacherhq/check-if-email-exists | 8.5k | Integrate later | Medium | 5-9h |
| omkarcloud/google-maps-scraper | 2.5k | Skip | Low | 7-11h |
