# Lead Intelligence Engine Production Hardening Design

**Date:** 2026-03-30

**Goal:** Stabilize the deployed app for real production use by fixing malformed Google OAuth requests, adding actual access control, moving long-running lead processing off the request path, automating Gmail watch renewal, improving operator visibility into failures, and refreshing the UI to a lighter dashboard style.

## Context

The current deployment is reachable and visually coherent, but several production blockers remain:

- Google OAuth fails with a Google `400` on connect.
- The dashboard is publicly accessible with no authentication.
- Lead discovery runs the full pipeline synchronously in the request path.
- Third-party failures are recorded inconsistently and lack durable retry behavior.
- Gmail watch registration is manual even though the watch expires on a schedule.
- The dashboard list does not paginate.
- The current dark palette does not match the desired product direction.

During investigation, the live `/api/google-workspace/connect` route was confirmed to emit `client_id` and `redirect_uri` query params with trailing newline characters, which makes the Google request malformed. This is an application-side config normalization problem.

## Approach Options

### Option 1: Patch each issue in place

Fix the OAuth route, add simple route guards, add a few retries in API routes, and restyle the existing components.

**Pros**

- Fastest path to partial improvements
- Minimal structural changes

**Cons**

- Leaves the synchronous orchestration model intact
- Leaves background processing undefined on Vercel
- Increases the odds of future regressions by spreading env parsing and auth logic

### Option 2: Introduce a serverless-friendly production architecture

Create a small internal-auth boundary, centralize env normalization, convert discovery into persisted async jobs processed by worker routes, add cron-driven maintenance for queued jobs and Gmail watch renewal, paginate the lead list, and refresh the visual system through shared tokens and component updates.

**Pros**

- Fixes the actual production constraints
- Matches Vercel’s execution model
- Creates one consistent place for config, auth, queueing, and maintenance logic

**Cons**

- Larger change set
- Requires schema and route updates

### Option 3: Add external auth/platform services first

Introduce a managed auth provider and a separate job runner platform, then refactor the app around them.

**Pros**

- Strong long-term extensibility
- Rich provider features

**Cons**

- Adds external product and setup complexity
- Unnecessary for the current “single operator internal tool” requirement

## Recommended Approach

Option 2.

This app is currently an internal operator system for a single user, deployed on Vercel, with a strong need for reliability over platform sprawl. The right fix is to harden the app around those constraints instead of layering more dependencies on top of unresolved core issues.

## Architecture

### 1. Configuration normalization and validation

Create a single env/config module that:

- trims all string inputs
- removes accidental surrounding whitespace and trailing newlines
- validates required URLs and secrets
- exposes typed config helpers for app URL, Google OAuth, operator auth, and cron protection

This module becomes the only place that reads raw env values for production-sensitive flows.

### 2. Internal operator authentication

Protect the app with a minimal internal login flow:

- env-backed operator email and password
- signed session cookie
- shared auth helpers for route handlers and server components
- request guard for app pages and mutating API routes

Because the user only needs a single account, this avoids coupling app access to the same Google OAuth flow that is currently being repaired.

### 3. Async orchestration with persisted jobs

Replace inline full-pipeline execution from discovery with a database-backed queue model:

- discovery request creates a batch and enqueues company jobs
- worker routes claim pending jobs in bounded chunks
- each job updates attempts, status, error, and next run time
- retries use backoff and stop after a bounded attempt count

This reuses the existing persisted job concepts and makes processing safe for Vercel’s request limits.

### 4. Scheduled maintenance

Use Vercel cron routes for:

- processing pending queued jobs
- retrying due failed jobs
- renewing Gmail watch before expiry

This keeps automation inside the deployment model the app already uses.

### 5. Pagination and operator visibility

Update repository queries and UI state so the lead table:

- fetches a limited page size
- renders pagination controls
- preserves current filters/search params where applicable

Also improve operator-facing status messaging for:

- Google Workspace config errors
- queued/running/failed job states
- Gmail watch renewal state

### 6. Visual redesign

Refresh the UI toward the provided reference with a lighter editorial dashboard style:

- off-white canvas
- soft blue/lilac accents
- glassy white panels
- more legible hierarchy and spacing
- consistent tokenized surfaces, borders, shadows, and typography

The redesign will preserve the underlying information architecture while making the app feel more premium and easier to scan.

## File Boundaries

### New or expanded core modules

- `lib/config/env.ts`
  Central typed env parsing and normalization.
- `lib/auth/session.ts`
  Session signing, cookie read/write, operator verification.
- `lib/auth/guards.ts`
  Shared route/page guard helpers.
- `lib/jobs/queue.ts`
  Job claiming, enqueueing, retry scheduling, completion/failure helpers.
- `lib/jobs/worker.ts`
  Bounded worker execution for company pipeline jobs.

### Route updates

- `app/api/google-workspace/connect/route.ts`
- `app/api/google-workspace/callback/route.ts`
- `app/api/discovery/search/route.ts`
- new cron/worker routes under `app/api/internal/...`
- new auth routes under `app/api/auth/...`

### UI updates

- `app/globals.css`
- `app/layout.tsx`
- `app/leads/page.tsx`
- lead dashboard components in `components/leads/*`
- new login screen in `app/login/page.tsx`

### Repository/query updates

- `lib/repositories/leads.ts`
- `lib/leads/view-models.ts`

## Data Flow

### Discovery

1. Operator submits discovery form.
2. Request persists batch and discovered companies.
3. Request enqueues company pipeline jobs and returns immediately.
4. Worker route processes jobs in small chunks.
5. UI shows batch queued/running/completed state after refresh.

### Google Workspace connect

1. Operator clicks connect.
2. App builds Google auth URL from normalized config.
3. OAuth callback exchanges code and stores encrypted tokens.
4. Gmail watch can be registered and later auto-renewed via cron.

### Auth

1. Operator signs in through login page.
2. App writes signed cookie.
3. Guarded pages and routes require a valid session.
4. Sign-out clears the cookie.

## Error Handling

- Invalid env configuration produces actionable operator-facing copy, not silent fallbacks.
- OAuth errors remain redirect-safe but persist a normalized failure reason for the dashboard.
- Worker failures increment attempts and schedule retries with backoff.
- Final exhaustion marks jobs failed with visible summaries.
- Cron routes return structured status summaries for observability and debugging.

## Testing Strategy

- unit tests for env normalization and operator auth/session helpers
- route tests for login/logout and guarded route behavior
- route tests for trimmed Google OAuth URL generation
- orchestration tests for enqueueing, claiming, retry scheduling, and worker completion
- repository tests for pagination behavior
- UI tests for login flow, paginated lead table, and updated workspace status copy

## Risks and Mitigations

- **Risk:** introducing auth can break existing pages or API calls
  **Mitigation:** central guard helpers and targeted route tests

- **Risk:** job claiming can double-run work
  **Mitigation:** claim transitions must be transactional and status-based

- **Risk:** cron routes may run with missing secrets
  **Mitigation:** protect cron routes with internal bearer auth and startup validation

- **Risk:** UI refresh could obscure workflow-critical controls
  **Mitigation:** preserve structure and flows while changing tokens, layout density, and visual language

## Success Criteria

- Google connect no longer produces a malformed Google request.
- The production app requires operator login before any lead data is visible.
- Discovery returns quickly and processing continues asynchronously.
- Failed jobs retry automatically and surface useful errors when exhausted.
- Gmail watch renewal no longer depends on a manual weekly click.
- Lead table supports pagination.
- The dashboard matches the lighter visual direction better than the current dark brown theme.
