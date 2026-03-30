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
- Google Workspace handoff for Gmail drafts and Sheets sync
- Optional HubSpot engagement mirroring

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
- `gmail_draft_links`
- `sheet_sync_records`
- `google_workspace_connections`
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

## Google Workspace setup

To enable real Gmail draft handoff and Google Sheets syncing:

1. In Google Cloud, enable the Gmail API, Google Sheets API, Google Drive API, Google Forms API, and Cloud Pub/Sub API.
2. Create an OAuth client for a web application.
3. Register this redirect URI:
   - `http://localhost:3000/api/google-workspace/callback`
4. Set these env vars in `.env` and `.env.local`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_WORKSPACE_TOKEN_SECRET`
   - `GOOGLE_GMAIL_PUBSUB_TOPIC`
   - `GOOGLE_GMAIL_PUSH_AUDIENCE`
   - `GOOGLE_GMAIL_PUSH_SERVICE_ACCOUNT_EMAIL` (optional but recommended)

`GOOGLE_WORKSPACE_TOKEN_SECRET` should be a long random string. The app uses it to encrypt stored Google access and refresh tokens before writing them to Postgres.

Once configured:
- open `/leads`
- use the `Connect Google` action in the `Google Workspace` card
- use `Start Gmail watch` once to register automatic Gmail engagement ingestion
- approve an outreach draft
- use `Create Gmail draft` to push it into Gmail
- use `Sync to Sheets` to append or update the `Drafts` tab in your configured spreadsheet
- use `Create live Google Form` and `Sync responses` on a lead to turn diagnostic submissions into lead-score updates

If you connected Google Workspace before the Forms response sync layer or Gmail watch layer was added, reconnect once so Google grants the latest Gmail read and Forms response scopes. The app now checks for those scopes and will prompt for reconnect if they are missing.

For automatic Gmail engagement ingestion:

- Create a Pub/Sub topic and push subscription that targets `/api/google-workspace/gmail-watch/webhook`.
- Set `GOOGLE_GMAIL_PUBSUB_TOPIC` to the full topic name, for example `projects/<project-id>/topics/<topic-name>`.
- Set `GOOGLE_GMAIL_PUSH_AUDIENCE` to the public webhook URL you configure on the push subscription.
- If you configure the push subscription with an authenticated service account, set `GOOGLE_GMAIL_PUSH_SERVICE_ACCOUNT_EMAIL` so the app can verify the caller.
- Gmail watches expire, so renew them periodically. The app exposes a `Renew Gmail watch` action in the dashboard, and you can automate that route with a cron later if you want hands-off renewal.

## Optional HubSpot mirror

HubSpot support is optional and only activates when `HUBSPOT_PRIVATE_APP_TOKEN` is set.

- The app looks up or creates the matching company and contact when possible.
- Outreach engagement can then be mirrored into HubSpot as a note on the matched records.
- If the token is missing, the HubSpot sync route skips cleanly instead of blocking the outreach flow.

Set this env var if you want the mirror flow:

- `HUBSPOT_PRIVATE_APP_TOKEN`
