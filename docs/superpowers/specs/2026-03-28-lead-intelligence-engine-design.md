# Lead Intelligence Engine Design

## Goal
Build an Apollo-first lead intelligence MVP that discovers companies, enriches them with evidence-backed commercial data, extracts relevant public website signals, generates structured pain hypotheses, scores lead quality, recommends a lead magnet, and drafts outreach inside a single-user internal dashboard.

## Product Shape
- Internal-only Next.js dashboard with no auth in v1
- PostgreSQL-backed data model with explicit source attribution and confidence metadata
- API-first provider adapters with retries, throttling, and partial-failure handling
- Queue-driven enrichment workflow so discovery, enrichment, extraction, and generation can run asynchronously
- CSV export, audit trail, and manual review controls for operators

## Architecture
### Frontend
- Next.js App Router with TypeScript and Tailwind
- Dashboard shell with search/discovery form, lead table, and lead detail workspace
- UI follows the uploaded `frontend-design-21` direction where it improves clarity: rounded panels, warm dark surfaces, motion used for hierarchy rather than novelty
- The base `frontend-design` skill referenced by the uploaded skill was not present locally, so the uploaded extension rules are used directly

### Backend
- Route handlers and server actions for internal workflows
- Prisma ORM on PostgreSQL
- `pg-boss` for background jobs so the queue can run off the same Postgres instance in local Docker
- Provider adapters under a shared interface:
  - discovery adapter
  - enrichment adapter
  - extraction adapter
  - AI generation adapter

### Data Flow
1. Operator runs discovery using industry, region, and size hints
2. Google Places returns candidate companies with place metadata
3. Apollo enriches organizations and likely decision makers
4. Firecrawl fetches allowed public pages from the company website
5. OpenAI generates strict-schema pain hypotheses from public evidence only
6. Later phases compute lead scores, lead magnets, and outreach drafts
7. Every stage emits source events and confidence metadata

## Phase Boundaries
### Phase 1
Scaffold the app, toolchain, Docker, environment handling, and shared primitives.

### Phase 2
Create the DB schema, migrations, seed data, and job/event tables.

### Phase 3
Implement Google Places discovery using current Places API (New) endpoints with field masks and normalized outputs.

### Phase 4
Implement Apollo organization and people enrichment as the primary enrichment path. Optional fallback providers remain stubs until later.

### Phase 5
Build the dashboard list/detail experience with source, confidence, and manual review visibility.

### Phase 6
Implement Firecrawl extraction only for public business websites and selected public pages.

### Phase 7
Implement strict pain hypothesis JSON output against the provided schema contract.

### Later Phases
Lead scoring, lead magnets, outreach generation, CSV export hardening, and optional fallback contact providers.

## Key Decisions
- Apollo remains the primary org/person/contact source. Snov.io or Hunter stay optional and are not required for MVP completion.
- APIs are preferred over scraping. No LinkedIn scraping or automation will be implemented.
- Google Places API (New) will be used instead of legacy search flows because current official docs emphasize field-mask-based New endpoints.
- Firecrawl will be scoped to allowed public business-site URLs only, with robots-aware crawling limits at the application layer.
- OpenAI structured outputs will be wired through strict JSON-schema validation and persisted together with evidence snippets.

## Error Handling
- Provider calls return normalized success or failure payloads rather than throwing raw upstream errors into the pipeline
- Rate-limit and retry metadata is captured in job logs
- Partial enrichment is persisted so a failed provider does not erase earlier successful stages
- User-facing status badges distinguish pending, partial, complete, blocked, and needs-review states

## Testing Strategy
- Unit tests for schema validation, scoring math, and adapter normalization
- Contract-style tests for provider adapters using mocked upstream responses
- Smoke tests for key dashboard routes and lead detail rendering
- Seed dataset for local demo flows without live provider keys

## Success Criteria
- A fresh local install runs through Docker with Postgres available
- An operator can discover leads, enrich them through Apollo, inspect a lead, crawl the public website, and view a stored pain hypothesis JSON payload with evidence and confidence
- The system favors fewer, better-supported leads over bulk collection
