# Playwright CLI Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent repo-local Playwright CLI workflow with local skills, scripts, docs, and verification.

**Architecture:** Keep the setup intentionally light: a pinned dev dependency plus workspace-local skill files and npm wrappers. Avoid adding the full Playwright test runner until browser automation and provider onboarding flows are proven useful.

**Tech Stack:** npm, Next.js repo scripts, Playwright CLI, Markdown docs

---

### Task 1: Install and verify the pinned CLI

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Install the dependency**

Run: `npm install -D @playwright/cli@latest`
Expected: dependency added to `devDependencies`

- [x] **Step 2: Install workspace skills**

Run: `npx playwright-cli install --skills`
Expected: `.claude/skills/playwright-cli/SKILL.md` created

- [x] **Step 3: Verify the CLI responds**

Run: `npx playwright-cli --help`
Expected: help output listing browser automation commands

### Task 2: Add durable repo ergonomics

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-03-29-playwright-cli-setup-design.md`
- Create: `docs/superpowers/plans/2026-03-29-playwright-cli-setup.md`

- [ ] **Step 1: Add npm scripts**

Add scripts for `pw`, `pw:help`, `pw:list`, and `pw:show`.

- [ ] **Step 2: Document the workflow**

Describe how the repo-local CLI is installed, how to reinstall skills, how to use sessions, and how this repo should use the browser automation tool.

### Task 3: Run verification

**Files:**
- Modify: `.claude/skills/playwright-cli/SKILL.md`

- [ ] **Step 1: Verify npm scripts resolve**

Run: `npm run pw:help`
Expected: Playwright CLI help output

- [ ] **Step 2: Verify browser launch path**

Run: `npm run pw -- open https://example.com`
Expected: browser session opens and returns page metadata

- [ ] **Step 3: Clean up**

Run: `npm run pw -- close`
Expected: browser session closes cleanly
