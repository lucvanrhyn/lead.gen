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
3. Run `docker compose up postgres -d`
4. Run `npm run dev`

The database schema, provider adapters, and pipeline routes will be added in the next phases.
