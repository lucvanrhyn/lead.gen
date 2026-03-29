# Playwright CLI Setup Design

## Goal

Pin `@playwright/cli` to this repository, install the accompanying local skill bundle, and document a permanent browser automation workflow for signup, inspection, and operator QA tasks.

## Scope

- Install `@playwright/cli` as a repo-local dev dependency.
- Install the Playwright CLI skill bundle into this workspace.
- Expose stable npm scripts for local usage.
- Document how this repo should use Playwright CLI for browser-driven research and setup tasks.

## Non-Goals

- Adding `@playwright/test` or a `playwright.config.ts` test runner in this pass.
- Writing end-to-end tests for the app.
- Automating account creation or secret issuance for third-party providers.

## Design

The repo will use `npx playwright-cli` under the hood via npm scripts so the version stays pinned to the project and does not depend on a global machine installation. The workspace-local skill installed by `playwright-cli install --skills` will be kept in-repo so the browser automation workflow is reproducible in future sessions.

The README will gain a focused section describing the install, the core commands, session behavior, and how to use Playwright CLI to inspect provider signup flows and local app behavior. This keeps setup discoverable without introducing a full testing framework before it is needed.
