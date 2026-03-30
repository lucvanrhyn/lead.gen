# Remaining Ops Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining multichannel operator gaps that do not require new user decisions: live Google Form creation, Gmail engagement ingestion, suppression and analytics, and optional HubSpot engagement mirroring.

**Architecture:** Extend the existing app-centered workflow rather than adding a second orchestration layer. Google Workspace remains the first-class outbound integration, while HubSpot stays optional and mirror-only behind env gates. All new behavior must be approval-first, database-backed, and regression-tested before wiring into the dashboard.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Google APIs (`googleapis`), optional HubSpot REST API, Vitest, TypeScript

---

### Task 1: Live Google Form Creation And Sync

**Files:**
- Modify: `lib/domain/google-workspace.ts`
- Modify: `lib/providers/google-workspace/oauth.ts`
- Create: `lib/providers/google-workspace/forms.ts`
- Modify: `app/api/leads/[id]/diagnostic-form-link/route.ts`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `components/leads/lead-detail-view.tsx`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/providers/google-workspace-forms.test.ts`
- Test: `tests/app/diagnostic-form-link-route.test.ts`

- [ ] Step 1: Write failing tests for Google Form creation payload mapping and live form link persistence.
- [ ] Step 2: Run the new tests and confirm they fail for the missing provider and route behavior.
- [ ] Step 3: Add Google Forms OAuth scope support and a Forms provider client that creates a form, adds sections/questions, and returns edit/respond URLs.
- [ ] Step 4: Update the diagnostic-form-link route to support provider-created forms when Google Workspace is connected, while keeping manual URL storage as fallback.
- [ ] Step 5: Surface live form metadata and creation status in the lead detail UI and README/env docs.
- [ ] Step 6: Re-run the focused tests and make them pass.

### Task 2: Gmail Thread Ingestion And Reply Synchronization

**Files:**
- Modify: `lib/domain/google-workspace.ts`
- Modify: `lib/providers/google-workspace/gmail.ts`
- Create: `app/api/outreach-drafts/[id]/refresh-gmail-thread/route.ts`
- Modify: `prisma/schema.prisma`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `components/leads/approval-queue.tsx`
- Modify: `components/leads/lead-detail-view.tsx`
- Modify: `prisma/seed.ts`
- Test: `tests/providers/google-workspace-gmail.test.ts`
- Test: `tests/app/refresh-gmail-thread-route.test.ts`

- [ ] Step 1: Write failing tests for Gmail thread refresh, reply detection, and engagement-event persistence from real Gmail thread data.
- [ ] Step 2: Run the focused tests and confirm they fail.
- [ ] Step 3: Extend the Gmail provider with message/thread retrieval helpers and payload parsing for reply, sent timestamp, and thread metadata.
- [ ] Step 4: Add a refresh route that pulls the Gmail draft/thread, logs reply engagement, updates delivery state, and stops follow-up generation where appropriate.
- [ ] Step 5: Surface thread refresh state, reply state, and last-synced metadata in the queue and lead detail views.
- [ ] Step 6: Re-run the focused tests and make them pass.

### Task 3: Suppression Rules And Campaign Analytics

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/domain/outreach-analytics.ts`
- Modify: `lib/ai/outreach.ts`
- Modify: `lib/orchestration/full-pipeline.ts`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `components/leads/approval-queue.tsx`
- Modify: `app/leads/page.tsx`
- Modify: `prisma/seed.ts`
- Test: `tests/domain/outreach-analytics.test.ts`
- Test: `tests/ui/leads.test.tsx`

- [ ] Step 1: Write failing tests for duplicate-contact suppression, company-level cooldowns, and analytics rollups.
- [ ] Step 2: Run the focused tests and confirm they fail.
- [ ] Step 3: Add schema fields and domain helpers for suppression reasons, delivery state, company rollups, and campaign metrics.
- [ ] Step 4: Prevent new drafts when the contact/company is already actively engaged or recently contacted, and expose the suppression reason in the UI.
- [ ] Step 5: Add approval-queue and dashboard analytics for sent, viewed, replied, follow-up due, and suppressed counts.
- [ ] Step 6: Re-run the focused tests and make them pass.

### Task 4: Optional HubSpot Engagement Mirroring

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/providers/hubspot/client.ts`
- Create: `app/api/outreach-drafts/[id]/sync-hubspot/route.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `components/leads/lead-detail-view.tsx`
- Test: `tests/providers/hubspot-client.test.ts`
- Test: `tests/app/sync-hubspot-route.test.ts`

- [ ] Step 1: Write failing tests for optional HubSpot sync payloads and route behavior when the token is configured or missing.
- [ ] Step 2: Run the focused tests and confirm they fail.
- [ ] Step 3: Implement a HubSpot provider that upserts the company/contact when possible and mirrors outreach events as timeline notes or sync records.
- [ ] Step 4: Add a guarded sync route and UI state that make the feature optional when `HUBSPOT_PRIVATE_APP_TOKEN` is missing.
- [ ] Step 5: Update env and README documentation for the optional mirror flow.
- [ ] Step 6: Re-run the focused tests and make them pass.
