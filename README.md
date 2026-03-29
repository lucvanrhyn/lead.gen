# Lead Intelligence Engine

Apollo-first lead discovery and enrichment for high-quality B2B outreach.

## MVP scope
- Next.js internal dashboard
- PostgreSQL-backed pipeline state
- Google Places discovery
- Apollo enrichment
- Firecrawl extraction
- Structured pain hypotheses
- Lead scoring, lead magnets, and outreach generation
- Batch auto-run orchestration from discovery
- Diagnostic Google Form blueprint generation and storage

## Local setup
1. Copy `.env.example` to `.env`
2. Run `npm install`
3. Start a PostgreSQL server that matches `DATABASE_URL`
4. Run `npm run db:generate`
5. Run `npm run db:push`
6. Run `npm run db:seed`
7. Run `npm run dev`

If Docker is available, `docker compose up postgres -d` will start the expected local database service.

For Supabase-backed environments, prefer the session pooler connection string (`aws-<region>.pooler.supabase.com:5432`) for Prisma, the Next.js app, and `pg-boss`. The direct `db.<project-ref>.supabase.co:5432` hostname can be IPv6-only and may not resolve from every local environment.

## Playwright CLI

This repo now pins `@playwright/cli` locally instead of relying on a machine-wide install.

- Run `npm run pw:help` to see the available browser automation commands.
- Run `npm run pw -- open https://example.com` to open a browser session.
- Run `npm run pw:list` to inspect active sessions.
- Run `npm run pw:show` to open the Playwright session monitor.
- Run `npm run pw:install-skills` to reinstall the local skill bundle if needed.
- Run `npm run pw:install-browser` if you want Playwright to install its own browser instead of using the detected local Chrome.

The workspace-local skill installed by Playwright CLI lives at [`.claude/skills/playwright-cli/SKILL.md`](/Users/lucvanrhyn/Documents/Business/Outreach/.claude/skills/playwright-cli/SKILL.md). The tool is useful for:

- walking provider signup flows and pricing pages
- inspecting local UI behavior in the browser
- taking snapshots and screenshots during QA
- preserving session state while researching onboarding requirements

For repeatable repo usage, prefer the npm scripts above over a global `playwright-cli` install.

## Current data model
- `companies`
- `contacts`
- `lead_batches`
- `batch_leads`
- `company_locations`
- `technology_profiles`
- `news_mentions`
- `crawl_pages`
- `pain_hypotheses`
- `lead_scores`
- `lead_magnets`
- `outreach_drafts`
- `diagnostic_form_blueprints`
- `diagnostic_form_links`
- `source_events`
- `enrichment_jobs`

## Batch automation and forms

- Discovery now creates a persisted `lead_batch` and auto-runs the full pipeline for each discovered company by default.
- The company pipeline now generates:
  - Apollo enrichment
  - Firecrawl extraction when a website exists
  - pain hypothesis
  - lead score
  - lead magnet
  - diagnostic form blueprint
  - outreach drafts for every valid contact
- The diagnostic form layer is stored as a blueprint first, with an optional live Google Form URL and response status attached later.
- When a form response summary is saved, the app records score impact and persists an updated lead score using the extra urgency/readiness signals.

## Approval queue and outreach ops

- Generated outreach drafts now enter a `PENDING_APPROVAL` state by default.
- The `/leads` dashboard now includes an approval queue with per-draft Gmail and Sheets sync badges.
- Approving a draft marks it ready for Gmail handoff and stores Gmail sync metadata separately from the draft body.
- Google Sheets sync metadata is tracked per draft and per target tab so the app can remain the source of truth while Sheets acts as the operator ledger.

The next slices build on this with real Gmail draft delivery, Sheets row syncing, LinkedIn manual task generation, and follow-up automation.
