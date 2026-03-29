# Batch Automation And Form Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch-aware discovery that auto-runs the existing lead pipeline and add the first Google Form diagnostic foundation with storage, generation, and dashboard visibility.

**Architecture:** Extend the current company-centric schema with a thin batch layer and a diagnostic-form layer rather than replacing the existing lead tables. Keep orchestration server-side in route handlers and shared library helpers so the current single-lead endpoints still work, while discovery can now trigger the same stages for an entire batch and persist partial results safely.

**Tech Stack:** Next.js App Router route handlers, React client/server components, Prisma with PostgreSQL, Zod, Vitest, existing OpenAI-backed AI helpers.

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  - Add batch models, diagnostic form models/enums, and any new relations needed from `Company`.
- `prisma/seed.ts`
  - Seed at least one diagnostic form example so the dashboard can render non-empty state locally.
- `app/api/discovery/search/route.ts`
  - Create a batch record, persist search metadata, and optionally trigger auto-run batch orchestration.
- `app/leads/page.tsx`
  - Load the latest batches/queue summary for the dashboard.
- `components/leads/discovery-form.tsx`
  - Expand discovery submission to opt into auto-run and surface batch progress messaging.
- `components/leads/lead-detail-view.tsx`
  - Add the first form blueprint panel and related actions.
- `components/leads/pipeline-actions.tsx`
  - Add `Generate form` action and keep manual single-lead controls compatible with the new orchestration helpers.
- `lib/repositories/leads.ts`
  - Load batch summary data and latest form blueprint data with the lead detail.
- `lib/leads/view-models.ts`
  - Extend view models with batch and diagnostic form fields.
- `lib/ai/outreach.ts`
  - Add form CTA variants and support deciding between lead magnet only, form only, or both.
- `lib/ai/lead-score.ts`
  - Add form-response-driven score impacts in a backward-compatible way.
- `tests/ui/leads.test.tsx`
  - Cover the new dashboard and form panel rendering.
- `tests/ai/outreach.test.ts`
  - Cover new CTA variants with form language.
- `tests/ai/lead-score.test.ts`
  - Cover score impact from diagnostic form response summaries.

### New files to create

- `lib/domain/batches.ts`
  - Batch status helpers, stage ordering, and persistence-safe summary builders.
- `lib/domain/diagnostic-forms.ts`
  - Shared types and helpers for form blueprint defaults and response-state derivation.
- `lib/ai/diagnostic-form.ts`
  - Form blueprint schema, industry adaptation logic, CTA generation, and persistence helper.
- `lib/orchestration/full-pipeline.ts`
  - Shared company-level pipeline runner that reuses current enrich/crawl/pain/score/magnet/outreach behavior.
- `lib/orchestration/discovery-batch.ts`
  - Batch creation, candidate association, auto-run loop, partial-failure handling, and summary reporting.
- `app/api/leads/[id]/diagnostic-form/route.ts`
  - Single-lead form blueprint generation endpoint.
- `app/api/leads/[id]/diagnostic-form-link/route.ts`
  - Save/update a live Google Form URL and response status.
- `tests/ai/diagnostic-form.test.ts`
  - TDD coverage for common-core form generation, industry-specific additions, and CTA copy.
- `tests/domain/batches.test.ts`
  - TDD coverage for batch summary/state helpers.
- `tests/orchestration/discovery-batch.test.ts`
  - TDD coverage for auto-run sequencing and partial-failure behavior.

## Task 1: Add Batch And Diagnostic Form Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Test: `tests/domain/batches.test.ts`

- [ ] **Step 1: Write the failing batch/domain tests**

```ts
import { describe, expect, it } from "vitest";
import { deriveBatchStatusSummary } from "@/lib/domain/batches";

describe("deriveBatchStatusSummary", () => {
  it("marks a batch partial when at least one company fails but others complete", () => {
    expect(
      deriveBatchStatusSummary([
        { companyId: "a", status: "SUCCEEDED" },
        { companyId: "b", status: "FAILED" },
      ]),
    ).toMatchObject({
      status: "PARTIAL",
      completedCompanies: 1,
      failedCompanies: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/batches.test.ts`
Expected: FAIL because `@/lib/domain/batches` and the batch helper do not exist yet.

- [ ] **Step 3: Add Prisma models and enums for batches and form storage**

Add minimal schema units:

- `LeadBatch`
  - `id`
  - `industry`
  - `region`
  - `requestedLeadCount`
  - `status`
  - `autoRunPipeline`
  - `completedCompanies`
  - `failedCompanies`
  - `createdAt`
  - `updatedAt`
- `BatchLead`
  - join between `LeadBatch` and `Company`
  - per-company batch status and error
- `DiagnosticFormBlueprint`
  - `companyId`
  - `painHypothesisId?`
  - `industry`
  - `primaryGoal`
  - `qualificationStrength`
  - `estimatedCompletionTime`
  - `formTitle`
  - `formIntro`
  - `closingMessage`
  - `outreachCtaShort`
  - `outreachCtaMedium`
  - `formSections Json`
  - `rawPayload Json`
- `DiagnosticFormLink`
  - `blueprintId`
  - `url`
  - `responseStatus`
  - `responseSummary Json?`
  - `scoreImpact Json?`

- [ ] **Step 4: Add the minimal batch helper implementation**

Create `lib/domain/batches.ts` with:

```ts
export function deriveBatchStatusSummary(
  items: Array<{ companyId: string; status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL" }>,
) {
  const completedCompanies = items.filter((item) => item.status === "SUCCEEDED").length;
  const failedCompanies = items.filter((item) => item.status === "FAILED").length;
  const status =
    failedCompanies > 0 && completedCompanies > 0
      ? "PARTIAL"
      : failedCompanies > 0
        ? "FAILED"
        : completedCompanies === items.length && items.length > 0
          ? "SUCCEEDED"
          : items.some((item) => item.status === "RUNNING")
            ? "RUNNING"
            : "PENDING";

  return { status, completedCompanies, failedCompanies, totalCompanies: items.length };
}
```

- [ ] **Step 5: Seed one diagnostic form example**

Update `prisma/seed.ts` so the local seed includes one blueprint and optional empty link record for the demo lead.

- [ ] **Step 6: Run tests to verify green**

Run: `npm test -- tests/domain/batches.test.ts`
Expected: PASS

- [ ] **Step 7: Validate Prisma schema**

Run: `npm run db:validate`
Expected: Prisma validates the new models successfully.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts lib/domain/batches.ts tests/domain/batches.test.ts
git commit -m "feat: add batch and diagnostic form schema"
```

## Task 2: Build The Diagnostic Form Blueprint Generator

**Files:**
- Create: `lib/domain/diagnostic-forms.ts`
- Create: `lib/ai/diagnostic-form.ts`
- Create: `tests/ai/diagnostic-form.test.ts`
- Modify: `lib/ai/outreach.ts`
- Modify: `tests/ai/outreach.test.ts`

- [ ] **Step 1: Write the failing diagnostic form tests**

```ts
import { describe, expect, it } from "vitest";
import { buildDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";

describe("buildDiagnosticFormBlueprint", () => {
  it("includes common sections and additive law-firm questions", () => {
    const blueprint = buildDiagnosticFormBlueprint({
      companyName: "Burger Huyser Attorneys",
      industry: "Law Firms",
      primaryPain: "slow intake and follow-up",
      serviceAngle: "improve intake handoff and response speed",
    });

    expect(blueprint.form_sections).toHaveLength(5);
    expect(JSON.stringify(blueprint.form_sections)).toContain("matter");
    expect(blueprint.estimated_completion_time).toBe("2-4 minutes");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ai/diagnostic-form.test.ts`
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement the shared form blueprint schema**

Define:

- `answerTypeSchema`
- `diagnosticQuestionSchema`
- `diagnosticSectionSchema`
- `diagnosticFormBlueprintSchema`
- `formUsageModeSchema`

Keep field names aligned with the approved spec.

- [ ] **Step 4: Implement the minimal common-core + additive industry generator**

In `lib/ai/diagnostic-form.ts`:
- create a common base question set for all industries
- add one additive question block per supported industry:
  - clinics
  - law firms
  - accountants
  - estate agents
  - home services
- cap output to 8-12 questions
- generate:
  - title
  - intro
  - closing message
  - CTA short
  - CTA medium

- [ ] **Step 5: Extend outreach generation with form-aware CTA variants**

Update `lib/ai/outreach.ts` to support:
- lead magnet only
- form only
- both together

Use short, friction-light wording such as:
- `I put together a short 2-minute workflow diagnostic`
- `I made a quick bottleneck assessment`

- [ ] **Step 6: Add persistence helper for form blueprints**

Add a helper that writes `DiagnosticFormBlueprint` records with the raw blueprint payload and optional pain hypothesis relation.

- [ ] **Step 7: Run the targeted tests**

Run:
- `npm test -- tests/ai/diagnostic-form.test.ts`
- `npm test -- tests/ai/outreach.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/domain/diagnostic-forms.ts lib/ai/diagnostic-form.ts lib/ai/outreach.ts tests/ai/diagnostic-form.test.ts tests/ai/outreach.test.ts
git commit -m "feat: add diagnostic form blueprint generator"
```

## Task 3: Add Shared Full-Pipeline And Batch Orchestration

**Files:**
- Create: `lib/orchestration/full-pipeline.ts`
- Create: `lib/orchestration/discovery-batch.ts`
- Create: `tests/orchestration/discovery-batch.test.ts`
- Modify: `app/api/discovery/search/route.ts`
- Modify: `app/api/leads/[id]/outreach/route.ts`

- [ ] **Step 1: Write the failing batch orchestration tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { runDiscoveryBatchPipeline } from "@/lib/orchestration/discovery-batch";

describe("runDiscoveryBatchPipeline", () => {
  it("continues the batch when one company stage fails", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({ status: "SUCCEEDED" })
      .mockResolvedValueOnce({ status: "FAILED", error: "apollo blocked" });

    const result = await runDiscoveryBatchPipeline(
      [{ companyId: "a" }, { companyId: "b" }],
      { runCompanyPipeline: runner },
    );

    expect(result.status).toBe("PARTIAL");
    expect(result.failedCompanies).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/orchestration/discovery-batch.test.ts`
Expected: FAIL because the orchestration module does not exist yet.

- [ ] **Step 3: Extract the single-company pipeline into a shared helper**

In `lib/orchestration/full-pipeline.ts`:
- use current enrich/crawl/pain/score/lead-magnet/outreach logic
- keep `hasWebsite` crawl behavior
- generate outreach for every valid contact instead of just the top contact
- invoke diagnostic form generation after pain hypothesis and before outreach
- return stage-by-stage results without throwing away partial progress

- [ ] **Step 4: Implement the batch runner**

In `lib/orchestration/discovery-batch.ts`:
- create a batch record
- call Google Places discovery with persistence on
- associate discovered companies to the batch
- if `autoRunPipeline` is true, run the shared company pipeline serially for now
- persist per-company status/errors in `BatchLead`
- compute final batch summary with `deriveBatchStatusSummary`

- [ ] **Step 5: Wire the discovery route to the batch runner**

Update `app/api/discovery/search/route.ts` so POST now returns:
- `batch`
- `candidates`
- `summary`

and accepts:
- `autoRunPipeline?: boolean`

- [ ] **Step 6: Keep the single-lead route compatible**

Update `app/api/leads/[id]/outreach/route.ts` to use the shared orchestration helper for generating drafts per contact where possible, while preserving the existing response shape.

- [ ] **Step 7: Run targeted tests**

Run:
- `npm test -- tests/orchestration/discovery-batch.test.ts`
- `npm test -- tests/providers/google-places.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/orchestration/full-pipeline.ts lib/orchestration/discovery-batch.ts app/api/discovery/search/route.ts app/api/leads/[id]/outreach/route.ts tests/orchestration/discovery-batch.test.ts
git commit -m "feat: automate discovery batch pipeline"
```

## Task 4: Add Form Endpoints, Dashboard Data, And UI Hooks

**Files:**
- Create: `app/api/leads/[id]/diagnostic-form/route.ts`
- Create: `app/api/leads/[id]/diagnostic-form-link/route.ts`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `components/leads/discovery-form.tsx`
- Modify: `components/leads/lead-detail-view.tsx`
- Modify: `components/leads/pipeline-actions.tsx`
- Modify: `app/leads/page.tsx`
- Test: `tests/ui/leads.test.tsx`

- [ ] **Step 1: Write the failing UI test**

```tsx
it("shows the latest diagnostic form blueprint and generate action", async () => {
  render(<LeadDetailView lead={leadWithFormBlueprint} />);

  expect(screen.getByText(/generate form/i)).toBeInTheDocument();
  expect(screen.getByText(/workflow diagnostic/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: FAIL because the new form panel and action do not exist.

- [ ] **Step 3: Add diagnostic form endpoints**

`app/api/leads/[id]/diagnostic-form/route.ts`
- load company + latest pain hypothesis
- generate and persist blueprint
- return blueprint JSON

`app/api/leads/[id]/diagnostic-form-link/route.ts`
- accept `url`, `responseStatus`, `responseSummary`
- save/update the live form link row

- [ ] **Step 4: Extend repository and view model loaders**

Load:
- latest batch summary for the leads page
- latest diagnostic blueprint and link per lead

- [ ] **Step 5: Update the discovery form for auto-run**

Change the submit payload to include:

```ts
{
  ...form,
  persist: true,
  autoRunPipeline: true,
}
```

Surface a result message like:
- `Discovered 5 leads and started the full pipeline for the batch.`

- [ ] **Step 6: Update lead detail and action UI**

Add:
- `Generate form` pipeline action
- form blueprint card in the outreach/detail area
- `Copy Google Form Structure` action
- live Google Form URL field
- response-status label

- [ ] **Step 7: Run the targeted UI tests**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/api/leads/[id]/diagnostic-form/route.ts app/api/leads/[id]/diagnostic-form-link/route.ts lib/repositories/leads.ts lib/leads/view-models.ts app/leads/page.tsx components/leads/discovery-form.tsx components/leads/lead-detail-view.tsx components/leads/pipeline-actions.tsx tests/ui/leads.test.tsx
git commit -m "feat: add diagnostic form workflow to dashboard"
```

## Task 5: Add Form-Driven Score Impact And Final Verification

**Files:**
- Modify: `lib/ai/lead-score.ts`
- Modify: `tests/ai/lead-score.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing lead-score test**

```ts
it("raises urgency and qualification confidence when a form response shows active buying intent", () => {
  const score = scoreLeadContext({
    // existing fields...
    formResponse: {
      status: "RESPONDED",
      urgencyLevel: "HIGH",
      budgetReadiness: "READY",
      workflowDetailDepth: "DETAILED",
    },
  });

  expect(score.components.urgency_signals).toBeGreaterThan(40);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ai/lead-score.test.ts`
Expected: FAIL because score input does not yet support form-response context.

- [ ] **Step 3: Add minimal score-impact support**

Extend `scoreLeadContext` input with optional form-response summary and adjust:
- urgency
- serviceability
- outreach confidence

Keep the change incremental rather than rewriting the scoring model.

- [ ] **Step 4: Document the form layer**

Update `README.md` with:
- batch auto-run behavior
- diagnostic form blueprint flow
- live form URL storage
- response-status and score-impact behavior

- [ ] **Step 5: Run full verification**

Run:
- `npm run db:validate`
- `npm test`
- `npm run lint`
- `npm run typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ai/lead-score.ts tests/ai/lead-score.test.ts README.md
git commit -m "feat: score leads with diagnostic form signals"
```
