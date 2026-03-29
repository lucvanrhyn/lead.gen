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
