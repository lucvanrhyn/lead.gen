# Lead Intelligence Engine MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Apollo-first MVP through discovery, enrichment, extraction, dashboard review, and pain-hypothesis generation.

**Architecture:** Use a Next.js App Router dashboard backed by PostgreSQL, Prisma, and `pg-boss`. External providers are isolated behind typed adapters with normalized outputs, source attribution, confidence metadata, and durable job records so the pipeline can tolerate partial failures.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, `pg-boss`, Zod, Vitest, React Testing Library, OpenAI SDK, Google Places API, Apollo API, Firecrawl API.

---

### Task 1: Repository And App Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `app/**/*`
- Create: `components/**/*`
- Create: `lib/**/*`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: Write a failing smoke test for the home dashboard shell**
- [ ] **Step 2: Run the test to verify it fails because the app is not scaffolded yet**
- [ ] **Step 3: Scaffold the Next.js app, shared UI shell, utilities, and base styling**
- [ ] **Step 4: Run targeted tests and the app build until the shell passes**
- [ ] **Step 5: Commit with a scaffold-focused message**

### Task 2: Database And Core Domain Models

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `lib/db.ts`
- Create: `lib/domain/*`
- Create: `lib/jobs/*`
- Create: `tests/db/*`

- [ ] **Step 1: Write failing tests for the core schema assumptions and normalization helpers**
- [ ] **Step 2: Run the tests to verify they fail before models exist**
- [ ] **Step 3: Implement Prisma models for companies, contacts, locations, technology profiles, news mentions, crawl pages, pain hypotheses, lead scores, lead magnets, outreach drafts, source events, and enrichment jobs**
- [ ] **Step 4: Add a seed script with one realistic demo lead and related records**
- [ ] **Step 5: Run Prisma validation, targeted tests, and generate the client**
- [ ] **Step 6: Commit the schema phase**

### Task 3: Google Places Discovery

**Files:**
- Create: `lib/providers/google-places/*`
- Create: `app/api/discovery/search/route.ts`
- Create: `tests/providers/google-places.test.ts`

- [ ] **Step 1: Write failing tests for request shaping, response normalization, and missing-key handling**
- [ ] **Step 2: Run the provider tests to verify red state**
- [ ] **Step 3: Implement Google Places API (New) text-search discovery with field masks and normalized company candidates**
- [ ] **Step 4: Persist discovery results and source events**
- [ ] **Step 5: Run provider tests and route-level smoke checks**
- [ ] **Step 6: Commit the discovery phase**

### Task 4: Apollo Enrichment

**Files:**
- Create: `lib/providers/apollo/*`
- Create: `app/api/leads/[id]/enrich/route.ts`
- Create: `tests/providers/apollo.test.ts`

- [ ] **Step 1: Write failing tests for organization enrichment, people enrichment, and confidence mapping**
- [ ] **Step 2: Run the tests to verify the adapter fails correctly before implementation**
- [ ] **Step 3: Implement Apollo organization enrichment and likely-decision-maker enrichment as the default contact path**
- [ ] **Step 4: Save normalized organization, contact, and source-event records while preserving partial success states**
- [ ] **Step 5: Keep Snov.io and Hunter as unimplemented fallback interfaces only**
- [ ] **Step 6: Run targeted tests and commit the enrichment phase**

### Task 5: Lead Table And Detail View

**Files:**
- Create: `app/leads/page.tsx`
- Create: `app/leads/[id]/page.tsx`
- Create: `components/leads/*`
- Create: `tests/ui/leads.test.tsx`

- [ ] **Step 1: Write failing UI tests for the lead list, detail tabs, and status badges**
- [ ] **Step 2: Run the tests to confirm the routes/components are missing**
- [ ] **Step 3: Implement the operator dashboard with list filters, detail tabs, evidence surfaces, and manual review controls**
- [ ] **Step 4: Apply the uploaded frontend skill to panel shape, type hierarchy, and motion without obscuring data density**
- [ ] **Step 5: Run UI tests and a production build**
- [ ] **Step 6: Commit the dashboard phase**

### Task 6: Firecrawl Extraction

**Files:**
- Create: `lib/providers/firecrawl/*`
- Create: `app/api/leads/[id]/crawl/route.ts`
- Create: `tests/providers/firecrawl.test.ts`

- [ ] **Step 1: Write failing tests for allowed-page selection, normalization, and extraction failure handling**
- [ ] **Step 2: Run the tests to verify red state**
- [ ] **Step 3: Implement Firecrawl extraction for selected public business-site pages only**
- [ ] **Step 4: Persist extracted pages and source events with source URLs**
- [ ] **Step 5: Run provider tests and commit the crawl phase**

### Task 7: Pain Hypothesis Structured Output

**Files:**
- Create: `lib/ai/*`
- Create: `app/api/leads/[id]/pain-hypothesis/route.ts`
- Create: `tests/ai/pain-hypothesis.test.ts`

- [ ] **Step 1: Write failing tests for schema validation and insufficient-evidence handling**
- [ ] **Step 2: Run the tests to confirm failure before implementation**
- [ ] **Step 3: Implement strict JSON-schema pain-hypothesis generation using the provided schema contract**
- [ ] **Step 4: Persist outputs, evidence snippets, model metadata, and confidence scores**
- [ ] **Step 5: Run AI-contract tests and commit the pain-hypothesis phase**

### Task 8: Scoring, Lead Magnets, And Outreach

**Files:**
- Create: `app/api/leads/[id]/score/route.ts`
- Create: `app/api/leads/[id]/lead-magnet/route.ts`
- Create: `app/api/leads/[id]/outreach/route.ts`
- Create: `tests/ai/lead-score.test.ts`
- Create: `tests/ai/lead-magnet.test.ts`
- Create: `tests/ai/outreach.test.ts`

- [ ] **Step 1: Write failing tests for weighted scoring, lead magnet schema adherence, and outreach schema adherence**
- [ ] **Step 2: Run the tests to establish red state**
- [ ] **Step 3: Implement transparent scoring with component subscores and explanations**
- [ ] **Step 4: Implement structured lead magnet generation**
- [ ] **Step 5: Implement outreach generation with compliance-safe prompt rules**
- [ ] **Step 6: Run the relevant test suite and commit the generation phase**

### Task 9: Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-03-28-lead-intelligence-engine-design.md`
- Modify: `docs/superpowers/plans/2026-03-28-lead-intelligence-engine-mvp.md`

- [ ] **Step 1: Run lint, tests, and production build**
- [ ] **Step 2: Reconcile the result against the requested phase list and documented scope**
- [ ] **Step 3: Update setup and architecture docs for local execution**
- [ ] **Step 4: Commit the verification and documentation phase**
