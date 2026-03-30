# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployed lead engine production-safe by fixing malformed Google OAuth, adding single-operator auth, converting discovery to async background execution, automating Gmail watch renewal, adding pagination, and refreshing the UI.

**Architecture:** Centralize env and auth logic, move long-running work into a persisted serverless-friendly queue processed by internal worker routes plus cron, and update the dashboard UI through shared visual tokens and paginated data access. The app remains an internal operator tool with one authenticated user.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, PostgreSQL, Vitest, Vercel cron routes, Google APIs

---

## File Map

### Create

- `lib/config/env.ts`
- `lib/auth/session.ts`
- `lib/auth/guards.ts`
- `app/login/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/internal/jobs/process/route.ts`
- `app/api/internal/google-workspace/renew-watch/route.ts`
- `tests/config/env.test.ts`
- `tests/auth/session.test.ts`
- `tests/app/auth-routes.test.ts`
- `tests/jobs/worker.test.ts`

### Modify

- `lib/providers/google-workspace/oauth.ts`
- `lib/domain/google-workspace.ts`
- `app/api/google-workspace/connect/route.ts`
- `app/api/google-workspace/callback/route.ts`
- `app/api/discovery/search/route.ts`
- `lib/orchestration/discovery-batch.ts`
- `lib/orchestration/full-pipeline.ts`
- `lib/repositories/leads.ts`
- `lib/leads/view-models.ts`
- `app/leads/page.tsx`
- `components/leads/discovery-form.tsx`
- `components/leads/google-workspace-status.tsx`
- `components/leads/lead-table.tsx`
- `components/leads/lead-detail-view.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `README.md`

### Review During Implementation

- `tests/app/google-workspace-routes.test.ts`
- `tests/orchestration/discovery-batch.test.ts`
- `tests/ui/leads.test.tsx`
- `prisma/schema.prisma`

---

### Task 1: Harden env parsing and Google OAuth generation

**Files:**
- Create: `lib/config/env.ts`
- Modify: `lib/providers/google-workspace/oauth.ts`
- Modify: `lib/domain/google-workspace.ts`
- Modify: `app/api/google-workspace/connect/route.ts`
- Test: `tests/config/env.test.ts`
- Test: `tests/app/google-workspace-routes.test.ts`

- [ ] **Step 1: Write failing env normalization tests**

Add tests that prove newline-polluted env vars are trimmed and invalid values are rejected.

- [ ] **Step 2: Run env-focused tests to verify failure**

Run: `npm test -- tests/config/env.test.ts tests/app/google-workspace-routes.test.ts`
Expected: FAIL because env normalization helpers do not exist yet.

- [ ] **Step 3: Implement normalized env helpers**

Create typed helpers for trimmed string, required secret, required URL, optional URL, and operator credentials.

- [ ] **Step 4: Route Google OAuth and workspace state through env helpers**

Update auth URL creation and workspace readiness checks to use normalized config instead of raw `process.env`.

- [ ] **Step 5: Run targeted tests to verify pass**

Run: `npm test -- tests/config/env.test.ts tests/app/google-workspace-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/config/env.ts lib/providers/google-workspace/oauth.ts lib/domain/google-workspace.ts app/api/google-workspace/connect/route.ts tests/config/env.test.ts tests/app/google-workspace-routes.test.ts
git commit -m "fix: normalize env config for google oauth"
```

### Task 2: Add internal operator authentication

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/guards.ts`
- Create: `app/login/page.tsx`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Modify: `app/layout.tsx`
- Modify: guarded app/api routes as needed
- Test: `tests/auth/session.test.ts`
- Test: `tests/app/auth-routes.test.ts`

- [ ] **Step 1: Write failing auth/session tests**

Cover cookie signing, invalid cookie rejection, successful login, failed login, and logout.

- [ ] **Step 2: Run auth tests to verify failure**

Run: `npm test -- tests/auth/session.test.ts tests/app/auth-routes.test.ts`
Expected: FAIL because auth modules/routes do not exist yet.

- [ ] **Step 3: Implement session helpers**

Create signed cookie generation, validation, and cookie config helpers.

- [ ] **Step 4: Implement login/logout routes and login page**

Support single operator credentials from env, set session cookie, and redirect to `/leads`.

- [ ] **Step 5: Add shared guards for pages and mutating routes**

Make lead pages and data-changing routes require an authenticated operator.

- [ ] **Step 6: Run auth tests to verify pass**

Run: `npm test -- tests/auth/session.test.ts tests/app/auth-routes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/auth/session.ts lib/auth/guards.ts app/login/page.tsx app/api/auth/login/route.ts app/api/auth/logout/route.ts tests/auth/session.test.ts tests/app/auth-routes.test.ts
git commit -m "feat: add operator authentication"
```

### Task 3: Move discovery to async queued execution

**Files:**
- Modify: `lib/orchestration/discovery-batch.ts`
- Modify: `app/api/discovery/search/route.ts`
- Create: `app/api/internal/jobs/process/route.ts`
- Modify: `lib/orchestration/full-pipeline.ts`
- Test: `tests/orchestration/discovery-batch.test.ts`
- Create: `tests/jobs/worker.test.ts`

- [ ] **Step 1: Write failing queue/worker tests**

Cover enqueue-only discovery responses, bounded job claiming, success completion, retry scheduling, and exhausted failure handling.

- [ ] **Step 2: Run orchestration tests to verify failure**

Run: `npm test -- tests/orchestration/discovery-batch.test.ts tests/jobs/worker.test.ts`
Expected: FAIL because async queue behavior is not implemented.

- [ ] **Step 3: Implement queue-aware discovery behavior**

Return quickly after persisting discovery and queueing pending work instead of running the whole pipeline inline.

- [ ] **Step 4: Implement worker route with bounded claims and retries**

Process pending jobs in chunks, update attempts/statuses, and schedule retry backoff.

- [ ] **Step 5: Record clearer batch/job summaries**

Ensure queued, running, partial, failed, and completed states are visible in persisted data.

- [ ] **Step 6: Run orchestration tests to verify pass**

Run: `npm test -- tests/orchestration/discovery-batch.test.ts tests/jobs/worker.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/orchestration/discovery-batch.ts app/api/discovery/search/route.ts app/api/internal/jobs/process/route.ts lib/orchestration/full-pipeline.ts tests/orchestration/discovery-batch.test.ts tests/jobs/worker.test.ts
git commit -m "feat: run lead processing asynchronously"
```

### Task 4: Automate Gmail watch renewal

**Files:**
- Create: `app/api/internal/google-workspace/renew-watch/route.ts`
- Modify: Google Workspace provider/domain helpers as needed
- Modify: `components/leads/google-workspace-status.tsx`
- Test: `tests/app/google-workspace-gmail-watch-routes.test.ts`

- [ ] **Step 1: Write failing renewal tests**

Cover renewal skip when disconnected, renewal when expiry is near, and protected internal route behavior.

- [ ] **Step 2: Run Gmail watch tests to verify failure**

Run: `npm test -- tests/app/google-workspace-gmail-watch-routes.test.ts`
Expected: FAIL because automated renewal route/logic is missing.

- [ ] **Step 3: Implement renewal route and shared renewal threshold logic**

Renew only when due, store result/error details, and return a summary payload.

- [ ] **Step 4: Update workspace status UI copy**

Show clearer watch status, renewal timing, and last error details.

- [ ] **Step 5: Run Gmail watch tests to verify pass**

Run: `npm test -- tests/app/google-workspace-gmail-watch-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/internal/google-workspace/renew-watch/route.ts components/leads/google-workspace-status.tsx tests/app/google-workspace-gmail-watch-routes.test.ts
git commit -m "feat: automate gmail watch renewal"
```

### Task 5: Add paginated lead queries and UI

**Files:**
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `app/leads/page.tsx`
- Modify: `components/leads/lead-table.tsx`
- Test: `tests/ui/leads.test.tsx`

- [ ] **Step 1: Write failing pagination tests**

Cover paginated repository output and next/previous controls rendering.

- [ ] **Step 2: Run UI tests to verify failure**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: FAIL because lead pagination is not implemented.

- [ ] **Step 3: Implement paginated lead repository query**

Use page number plus page size and return list metadata.

- [ ] **Step 4: Update page and table components**

Render pagination controls and preserve query parameters in links.

- [ ] **Step 5: Run UI tests to verify pass**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/repositories/leads.ts lib/leads/view-models.ts app/leads/page.tsx components/leads/lead-table.tsx tests/ui/leads.test.tsx
git commit -m "feat: paginate lead dashboard results"
```

### Task 6: Refresh the visual system and operator UI

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/leads/page.tsx`
- Modify: `components/leads/discovery-form.tsx`
- Modify: `components/leads/google-workspace-status.tsx`
- Modify: `components/leads/lead-table.tsx`
- Modify: `components/leads/lead-detail-view.tsx`
- Test: `tests/ui/leads.test.tsx`

- [ ] **Step 1: Add or adjust UI tests only where semantics change**

Keep tests behavior-oriented, not style-snapshot based.

- [ ] **Step 2: Implement shared visual tokens**

Introduce the lighter palette, panel system, shadows, spacing, and background treatment.

- [ ] **Step 3: Restyle dashboard and detail views**

Preserve workflows while improving hierarchy, readability, and polish.

- [ ] **Step 4: Run UI tests and typecheck**

Run: `npm test -- tests/ui/leads.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx app/leads/page.tsx components/leads/discovery-form.tsx components/leads/google-workspace-status.tsx components/leads/lead-table.tsx components/leads/lead-detail-view.tsx tests/ui/leads.test.tsx
git commit -m "feat: refresh dashboard visual design"
```

### Task 7: Wire deployment-facing docs and verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update production setup docs**

Document operator auth env vars, cron routes, and required Google redirect settings.

- [ ] **Step 2: Run focused verification suite**

Run: `npm test -- tests/config/env.test.ts tests/app/google-workspace-routes.test.ts tests/app/auth-routes.test.ts tests/orchestration/discovery-batch.test.ts tests/jobs/worker.test.ts tests/app/google-workspace-gmail-watch-routes.test.ts tests/ui/leads.test.tsx`
Expected: PASS

- [ ] **Step 3: Run full verification**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document production hardening setup"
```
