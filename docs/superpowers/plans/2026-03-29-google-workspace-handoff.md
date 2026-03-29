# Google Workspace Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real single-operator Google Workspace connection so approved outreach drafts can become actual Gmail drafts and Google Sheets rows from inside the app.

**Architecture:** Use one app-level Google OAuth web-server flow and persist the resulting refresh/access token set in the database as a workspace connection record. Keep Gmail draft creation and Sheets row sync behind dedicated provider helpers and route handlers so the approval queue remains the orchestration layer while external delivery stays replaceable and testable.

**Tech Stack:** Next.js App Router route handlers, Prisma with PostgreSQL, Zod, Vitest, Google OAuth 2.0 web-server flow, Gmail API drafts, Google Sheets API values append/update, `googleapis` Node client.

---

## File Structure

### Existing files to modify

- `package.json`
  - Add the Google API client dependency.
- `.env.example`
  - Document the Google OAuth and Sheets configuration required for this slice.
- `prisma/schema.prisma`
  - Add Google Workspace connection storage and outbound sync metadata needed for real handoff.
- `prisma/seed.ts`
  - Seed a disconnected workspace state while keeping approval queue demo data intact.
- `lib/repositories/leads.ts`
  - Load Google Workspace connection state and sync result details for the dashboard.
- `lib/leads/view-models.ts`
  - Extend queue and dashboard types with workspace connection status.
- `app/leads/page.tsx`
  - Show Workspace connection status alongside the approval queue.
- `components/leads/approval-queue.tsx`
  - Add “Create Gmail draft” and “Sync to Sheets” actions for approved drafts.
- `README.md`
  - Document Google OAuth setup, Gmail draft flow, and Sheets sync flow.

### New files to create

- `lib/domain/google-workspace.ts`
  - Helpers for connection-state derivation, scope lists, and operator-facing labels.
- `lib/providers/google-workspace/oauth.ts`
  - OAuth client construction, auth URL creation, and token exchange/refresh helpers.
- `lib/providers/google-workspace/gmail.ts`
  - Gmail draft payload creation and draft creation helper using `users.drafts.create`.
- `lib/providers/google-workspace/sheets.ts`
  - Spreadsheet append/update helpers for operator-ledger tabs.
- `app/api/google-workspace/connect/route.ts`
  - Starts the OAuth flow and redirects to Google consent.
- `app/api/google-workspace/callback/route.ts`
  - Exchanges the auth code for tokens and stores the workspace connection.
- `app/api/outreach-drafts/[id]/create-gmail-draft/route.ts`
  - Creates a real Gmail draft from an approved outreach draft and stores the returned draft/thread metadata.
- `app/api/outreach-drafts/[id]/sync-google-sheet/route.ts`
  - Appends or updates the draft record in the configured Google Sheet and stores the returned row identity.
- `components/leads/google-workspace-status.tsx`
  - Dashboard status card for connection and config readiness.
- `tests/domain/google-workspace.test.ts`
  - TDD coverage for connection state and required-env readiness.
- `tests/providers/google-workspace-gmail.test.ts`
  - TDD coverage for Gmail draft payload encoding and API request shape.
- `tests/providers/google-workspace-sheets.test.ts`
  - TDD coverage for Sheets append/update request construction.
- `tests/app/google-workspace-routes.test.ts`
  - TDD coverage for connect/callback route behavior.

## Task 1: Add Google Workspace Connection Schema And Readiness Helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`
- Modify: `prisma/seed.ts`
- Create: `lib/domain/google-workspace.ts`
- Create: `tests/domain/google-workspace.test.ts`

- [ ] **Step 1: Write the failing domain test**

```ts
import { deriveGoogleWorkspaceState } from "@/lib/domain/google-workspace";

describe("deriveGoogleWorkspaceState", () => {
  it("reports disconnected when OAuth env is present but no tokens are stored", () => {
    expect(
      deriveGoogleWorkspaceState({
        hasClientId: true,
        hasClientSecret: true,
        hasRedirectUri: true,
        hasSpreadsheetId: true,
        connection: null,
      }),
    ).toMatchObject({
      status: "DISCONNECTED",
      canStartOAuth: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/domain/google-workspace.test.ts`
Expected: FAIL because the helper and schema do not exist yet.

- [ ] **Step 3: Add Prisma models and enums**

Add:
- `WorkspaceConnectionStatus`
  - `DISCONNECTED`
  - `CONNECTED`
  - `ERROR`
- `GoogleWorkspaceConnection`
  - `provider`
  - `email?`
  - `scopes Json`
  - `encryptedAccessToken?`
  - `encryptedRefreshToken?`
  - `accessTokenExpiresAt?`
  - `status`
  - `lastError?`

Keep this as a single-operator connection record for v1.

- [ ] **Step 4: Add env keys to `.env.example`**

Add:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

- [ ] **Step 5: Implement the minimal readiness helper**

Create `lib/domain/google-workspace.ts` with:
- required Gmail/Sheets scopes
- env readiness helper
- connection status label helper

- [ ] **Step 6: Update the seed**

Seed a disconnected workspace record only if helpful for local UI, but do not seed real tokens.

- [ ] **Step 7: Run targeted tests and validate schema**

Run:
- `npm test -- tests/domain/google-workspace.test.ts`
- `npm run db:validate`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts .env.example lib/domain/google-workspace.ts tests/domain/google-workspace.test.ts
git commit -m "feat: add google workspace connection schema"
```

## Task 2: Build OAuth Client And Connection Routes

**Files:**
- Create: `lib/providers/google-workspace/oauth.ts`
- Create: `app/api/google-workspace/connect/route.ts`
- Create: `app/api/google-workspace/callback/route.ts`
- Create: `tests/app/google-workspace-routes.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
describe("google workspace connect route", () => {
  it("redirects to the Google consent URL when config is present", async () => {
    // mock auth URL creation
    // call route
    // assert redirect
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/google-workspace-routes.test.ts`
Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement the OAuth helper**

Use the Node client library and Google’s web-server OAuth flow.
Include:
- client construction
- auth URL generation
- code exchange
- token refresh helper

- [ ] **Step 4: Implement connect and callback routes**

`connect`
- verify required env
- redirect to consent URL

`callback`
- exchange code for tokens
- fetch the Gmail profile email if possible
- persist the connection record
- redirect back to `/leads`

- [ ] **Step 5: Run targeted tests**

Run: `npm test -- tests/app/google-workspace-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/providers/google-workspace/oauth.ts app/api/google-workspace/connect/route.ts app/api/google-workspace/callback/route.ts tests/app/google-workspace-routes.test.ts
git commit -m "feat: add google workspace oauth flow"
```

## Task 3: Build Gmail Draft Provider And Real Draft Route

**Files:**
- Create: `lib/providers/google-workspace/gmail.ts`
- Create: `tests/providers/google-workspace-gmail.test.ts`
- Create: `app/api/outreach-drafts/[id]/create-gmail-draft/route.ts`
- Modify: `components/leads/approval-queue.tsx`

- [ ] **Step 1: Write the failing Gmail provider test**

```ts
import { buildGmailDraftRawMessage } from "@/lib/providers/google-workspace/gmail";

describe("buildGmailDraftRawMessage", () => {
  it("builds a base64url encoded MIME message for a draft", () => {
    const raw = buildGmailDraftRawMessage({
      to: "megan@atlasdental.co.za",
      subject: "A quick idea for Atlas Dental bookings",
      body: "Hello Megan",
    });

    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/providers/google-workspace-gmail.test.ts`
Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement the Gmail draft helper**

Use:
- MIME message builder
- base64url encoding
- `users.drafts.create`

Store the returned:
- Gmail draft id
- Gmail message id if available

- [ ] **Step 4: Implement the create-draft route**

Route behavior:
- require `APPROVED` draft state
- require connected workspace
- require contact email
- create the Gmail draft
- persist/update `gmail_draft_links`
- return sync metadata

- [ ] **Step 5: Add queue action**

In the approval queue add a button for approved drafts:
- `Create Gmail draft`

Button should call the route and refresh the queue.

- [ ] **Step 6: Run targeted tests**

Run:
- `npm test -- tests/providers/google-workspace-gmail.test.ts`
- `npm test -- tests/ui/leads.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/providers/google-workspace/gmail.ts app/api/outreach-drafts/[id]/create-gmail-draft/route.ts components/leads/approval-queue.tsx tests/providers/google-workspace-gmail.test.ts tests/ui/leads.test.tsx
git commit -m "feat: create gmail drafts from approved outreach"
```

## Task 4: Build Sheets Sync Provider And Real Sync Route

**Files:**
- Create: `lib/providers/google-workspace/sheets.ts`
- Create: `tests/providers/google-workspace-sheets.test.ts`
- Create: `app/api/outreach-drafts/[id]/sync-google-sheet/route.ts`
- Modify: `components/leads/approval-queue.tsx`
- Modify: `lib/repositories/leads.ts`
- Modify: `lib/leads/view-models.ts`
- Create: `components/leads/google-workspace-status.tsx`
- Modify: `app/leads/page.tsx`

- [ ] **Step 1: Write the failing Sheets provider test**

```ts
import { buildDraftSheetRow } from "@/lib/providers/google-workspace/sheets";

describe("buildDraftSheetRow", () => {
  it("creates a company-contact-outreach row for the Drafts tab", () => {
    expect(
      buildDraftSheetRow({
        companyName: "Atlas Dental Group",
        contactName: "Megan Jacobs",
        approvalStatus: "APPROVED",
      }),
    ).toContain("Atlas Dental Group");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/providers/google-workspace-sheets.test.ts`
Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement Sheets helpers**

Use Google Sheets values append/update helpers for:
- `Drafts` tab
- storing row key metadata
- idempotent update when the same draft already has a row key

- [ ] **Step 4: Implement the sync route**

Route behavior:
- require connected workspace
- require configured spreadsheet id
- append or update the `Drafts` tab row
- persist/update `sheet_sync_records`
- return row metadata

- [ ] **Step 5: Add queue action and workspace status card**

Add:
- `Sync to Sheets` action for approved drafts
- a dashboard status card showing:
  - config readiness
  - connected/disconnected
  - connected Google email if available

- [ ] **Step 6: Run targeted tests**

Run:
- `npm test -- tests/providers/google-workspace-sheets.test.ts`
- `npm test -- tests/ui/leads.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/providers/google-workspace/sheets.ts app/api/outreach-drafts/[id]/sync-google-sheet/route.ts lib/repositories/leads.ts lib/leads/view-models.ts components/leads/approval-queue.tsx components/leads/google-workspace-status.tsx app/leads/page.tsx tests/providers/google-workspace-sheets.test.ts tests/ui/leads.test.tsx
git commit -m "feat: sync approved outreach to google sheets"
```

## Task 5: Full Verification And Workspace Setup Docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the Google setup flow**

Update `README.md` with:
- required Google APIs to enable
- OAuth client type
- redirect URI to register
- Gmail compose scope and Sheets scope
- where the operator starts the connection flow in the app

- [ ] **Step 2: Run full verification**

Run:
- `npm run db:generate`
- `npm run db:validate`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Expected: PASS

- [ ] **Step 3: Push schema and reseed**

Run:
- `npm run db:push`
- `npm run db:seed`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add google workspace setup guide"
```
