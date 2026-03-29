# Approval Queue And Outreach Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app approval queue for generated outreach and the first durable Gmail and Google Sheets sync records so the outreach workflow can move from “generated” to “operator-approved and sync-ready”.

**Architecture:** Extend the current outreach draft model with approval and sync state, then layer a queue-first repository and UI over that data. Keep external Gmail and Google Sheets integration behind app routes and persisted sync records so the app can support real delivery later without hard-coding credentials or bypassing the operator review step.

**Tech Stack:** Next.js App Router route handlers, React client/server components, Prisma with PostgreSQL, Zod, Vitest, existing lead repositories and view models.

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  - Add approval enums and sync record models tied to outreach drafts.
- `prisma/seed.ts`
  - Seed a pending approval queue item plus example Gmail and Sheets sync metadata.
- `lib/repositories/leads.ts`
  - Load approval queue data, queue counts, and sync-state details for the leads page and lead detail.
- `lib/leads/view-models.ts`
  - Extend types for queue rows, approval state, and sync metadata.
- `app/leads/page.tsx`
  - Show approval queue summary and queue panel above the lead table.
- `components/leads/lead-detail-view.tsx`
  - Show per-draft approval and sync state in the outreach tab.
- `components/leads/pipeline-actions.tsx`
  - Keep generation actions compatible with drafts now entering a pending-approval lifecycle.
- `lib/ai/outreach.ts`
  - Persist new drafts with pending approval by default.
- `tests/ui/leads.test.tsx`
  - Cover the approval queue panel and draft state rendering.

### New files to create

- `lib/domain/outreach-ops.ts`
  - Approval-state helpers, queue summaries, and sync-status derivation.
- `components/leads/approval-queue.tsx`
  - Queue-first operator surface for pending approvals.
- `app/api/outreach-drafts/[id]/approve/route.ts`
  - Approve a generated draft and mark it ready for Gmail handoff.
- `app/api/outreach-drafts/[id]/reject/route.ts`
  - Reject a generated draft while preserving the audit trail.
- `app/api/outreach-drafts/[id]/gmail-sync/route.ts`
  - Store Gmail draft metadata such as draft id and thread id after handoff.
- `app/api/outreach-drafts/[id]/sheet-sync/route.ts`
  - Store Google Sheets sync metadata and per-tab row identity.
- `tests/domain/outreach-ops.test.ts`
  - TDD coverage for queue summary and approval transitions.
- `tests/app/approval-queue-routes.test.ts`
  - TDD coverage for approve/reject route behavior.

## Task 1: Add Outreach Approval And Sync Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Create: `tests/domain/outreach-ops.test.ts`

- [ ] **Step 1: Write the failing outreach-ops domain test**

```ts
import { ApprovalStatus, ExternalSyncStatus } from "@prisma/client";
import { deriveApprovalQueueSummary } from "@/lib/domain/outreach-ops";

describe("deriveApprovalQueueSummary", () => {
  it("counts pending approvals and synced drafts separately", () => {
    expect(
      deriveApprovalQueueSummary([
        { approvalStatus: ApprovalStatus.PENDING_APPROVAL, gmailSyncStatus: ExternalSyncStatus.NOT_READY },
        { approvalStatus: ApprovalStatus.APPROVED, gmailSyncStatus: ExternalSyncStatus.SYNCED },
      ]),
    ).toMatchObject({
      pendingApprovalCount: 1,
      syncedDraftCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/outreach-ops.test.ts`
Expected: FAIL because the domain helper and enums do not exist yet.

- [ ] **Step 3: Add Prisma enums and models**

Add:
- `ApprovalStatus`
  - `PENDING_APPROVAL`
  - `APPROVED`
  - `REJECTED`
- `ExternalSyncStatus`
  - `NOT_READY`
  - `READY`
  - `SYNCED`
  - `FAILED`
- fields on `OutreachDraft`
  - `approvalStatus`
  - `approvalNotes?`
  - `approvedAt?`
- `GmailDraftLink`
  - `outreachDraftId`
  - `gmailDraftId`
  - `gmailThreadId?`
  - `syncStatus`
  - `lastSyncedAt?`
- `SheetSyncRecord`
  - `outreachDraftId`
  - `tabName`
  - `rowKey`
  - `syncStatus`
  - `lastSyncedAt?`

- [ ] **Step 4: Add the minimal outreach-ops helper**

Create `lib/domain/outreach-ops.ts` with summary helpers and a small approval transition helper.

- [ ] **Step 5: Seed one pending draft and one synced draft**

Update `prisma/seed.ts` so the demo lead shows:
- at least one `PENDING_APPROVAL` draft
- example Gmail sync metadata
- example Sheets sync metadata

- [ ] **Step 6: Run targeted tests and validate schema**

Run:
- `npm test -- tests/domain/outreach-ops.test.ts`
- `npm run db:validate`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts lib/domain/outreach-ops.ts tests/domain/outreach-ops.test.ts
git commit -m "feat: add outreach approval and sync schema"
```

## Task 2: Add Approval And Sync Routes

**Files:**
- Create: `app/api/outreach-drafts/[id]/approve/route.ts`
- Create: `app/api/outreach-drafts/[id]/reject/route.ts`
- Create: `app/api/outreach-drafts/[id]/gmail-sync/route.ts`
- Create: `app/api/outreach-drafts/[id]/sheet-sync/route.ts`
- Create: `tests/app/approval-queue-routes.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
import { POST as approveDraft } from "@/app/api/outreach-drafts/[id]/approve/route";

describe("approve outreach draft route", () => {
  it("marks a pending draft approved and ready for Gmail sync", async () => {
    // create a seeded draft fixture
    // call route
    // assert approval status changed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/approval-queue-routes.test.ts`
Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement approval routes**

`approve`
- set `approvalStatus=APPROVED`
- set `approvedAt=now`
- make Gmail sync status `READY`

`reject`
- set `approvalStatus=REJECTED`
- optionally store `approvalNotes`

- [ ] **Step 4: Implement sync metadata routes**

`gmail-sync`
- store draft id / thread id / sync status

`sheet-sync`
- store tab name / row key / sync status

- [ ] **Step 5: Run targeted route tests**

Run: `npm test -- tests/app/approval-queue-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/outreach-drafts/[id]/approve/route.ts app/api/outreach-drafts/[id]/reject/route.ts app/api/outreach-drafts/[id]/gmail-sync/route.ts app/api/outreach-drafts/[id]/sheet-sync/route.ts tests/app/approval-queue-routes.test.ts
git commit -m "feat: add outreach approval and sync routes"
```

## Task 3: Add Approval Queue Repository And UI

**Files:**
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Modify: `app/leads/page.tsx`
- Create: `components/leads/approval-queue.tsx`
- Modify: `components/leads/lead-detail-view.tsx`
- Modify: `tests/ui/leads.test.tsx`

- [ ] **Step 1: Write the failing UI test**

```tsx
it("renders the approval queue with pending drafts and sync badges", () => {
  render(<ApprovalQueue items={queueItems} summary={queueSummary} />);

  expect(screen.getByText(/approval queue/i)).toBeInTheDocument();
  expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
  expect(screen.getByText(/gmail ready/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: FAIL because the queue UI does not exist.

- [ ] **Step 3: Add repository loaders**

Load:
- approval queue summary
- pending queue items
- per-draft approval and sync state for lead detail

- [ ] **Step 4: Build the approval queue component**

Render:
- queue summary counts
- pending company/contact/draft rows
- approval status
- Gmail sync status
- Sheets sync status
- link to lead detail

- [ ] **Step 5: Surface draft state in lead detail**

For each outreach draft show:
- approval status
- Gmail sync badge
- Sheets sync badge

- [ ] **Step 6: Run targeted UI tests**

Run: `npm test -- tests/ui/leads.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/repositories/leads.ts lib/leads/view-models.ts app/leads/page.tsx components/leads/approval-queue.tsx components/leads/lead-detail-view.tsx tests/ui/leads.test.tsx
git commit -m "feat: add outreach approval queue"
```

## Task 4: Default New Drafts Into The Approval Workflow And Verify

**Files:**
- Modify: `lib/ai/outreach.ts`
- Modify: `components/leads/pipeline-actions.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write the failing behavior test**

Extend existing outreach tests or add a repository assertion showing newly persisted drafts default to `PENDING_APPROVAL`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ai/outreach.test.ts`
Expected: FAIL because persisted drafts do not yet carry approval workflow state.

- [ ] **Step 3: Update draft persistence defaults**

Newly generated drafts should:
- start as `PENDING_APPROVAL`
- create sync status as `NOT_READY`

- [ ] **Step 4: Document the operator workflow**

Update `README.md` with:
- approval queue behavior
- approve/reject lifecycle
- Gmail sync metadata
- Google Sheets sync metadata

- [ ] **Step 5: Run full verification**

Run:
- `npm run db:validate`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ai/outreach.ts components/leads/pipeline-actions.tsx README.md
git commit -m "feat: route outreach into approval queue"
```
