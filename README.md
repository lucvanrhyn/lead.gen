# Lead Intelligence Engine

Apollo-first lead discovery and enrichment for high-quality B2B outreach.

## MVP scope
- Next.js internal dashboard
- PostgreSQL-backed pipeline state
- Google Places discovery
- Apollo enrichment
- Firecrawl extraction
- Structured pain hypotheses
- Later phases for scoring, lead magnets, and outreach generation

## Local setup
1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Start a PostgreSQL server that matches `DATABASE_URL`
4. Run `npm run db:generate`
5. Run `npm run db:push`
6. Run `npm run db:seed`
7. Run `npm run dev`

If Docker is available, `docker compose up postgres -d` will start the expected local database service.

## Current data model
- `companies`
- `contacts`
- `company_locations`
- `technology_profiles`
- `news_mentions`
- `crawl_pages`
- `pain_hypotheses`
- `lead_scores`
- `lead_magnets`
- `outreach_drafts`
- `source_events`
- `enrichment_jobs`

The provider adapters, queue workers, and pipeline routes will be layered on top of this schema in the next phases.
