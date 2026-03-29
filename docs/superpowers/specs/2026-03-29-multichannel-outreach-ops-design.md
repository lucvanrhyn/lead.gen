# Multichannel Outreach Ops Design

## Goal

Extend the lead generator from a single-lead operator tool into an app-centered, approval-first multichannel outreach system that can:

- auto-run the full lead pipeline for a discovered batch
- generate drafts for every valid contact at each company
- support manual LinkedIn outreach without LinkedIn automation
- support explicit-approval website contact-form submission
- sync operating data to Google Sheets
- use Gmail as the final send surface
- mirror engagement signals into HubSpot
- auto-generate follow-up drafts based on engagement, while keeping send approval human-controlled

## Product Position

This product is not becoming a Gmail clone or a HubSpot clone in v1. The app remains the orchestration layer and approval console.

- The app is the command center
- Gmail is the final send surface
- Google Sheets is the operator ledger
- HubSpot is the engagement mirror first, not the primary CRM

This keeps the workflow fast, reviewable, and extensible without overcommitting to CRM complexity too early.

## Core Operating Model

### Search And Batch Automation

When the operator chooses:

- `industry`
- `region`
- `lead count`

the system should:

1. create a batch record
2. discover company leads
3. auto-run the full pipeline for each discovered company

The default batch pipeline should include:

1. Google Places discovery
2. Apollo company enrichment
3. Apollo contact enrichment when plan access allows it
4. Firecrawl extraction
5. pain hypothesis generation
6. lead scoring
7. lead magnet generation
8. outreach draft generation for every valid contact

Partial failures must not collapse the batch. Each company should land in an approval queue with the best available output from successful stages.

### Approval-First Sending

The system should remain approval-first:

- drafts are generated automatically
- follow-ups are generated automatically
- sends are never automatic in v1

The app is the primary review surface. Gmail is the final approval and send surface.

### Company-First, Contact-Level Outreach

The operator thinks in companies, but actual outreach is contact-level. Therefore:

- the company is the primary campaign unit
- each company can have many contacts
- one email draft is created per valid contact
- one LinkedIn task is created per relevant contact
- one website-form submission candidate is created per company

This avoids flattening multi-contact companies into a single row or a single email while still keeping the campaign understandable at a company level.

## Channel Design

### Email

Email is the primary outbound channel.

Rules:

- generate one Gmail draft per valid contact
- drafts may share a common company-level lead magnet and core angle
- subject and body may lightly adapt by title, seniority, or confidence
- the lead magnet should be delivered as a tracked hosted link, not as a raw attachment
- reply tracking is contact-specific
- follow-ups are contact-specific

### Manual LinkedIn

LinkedIn should be supported only as a manual workflow layer.

Rules:

- no LinkedIn scraping
- no automated connection requests
- no automated LinkedIn messages
- no browser-based LinkedIn automation

The system should:

- identify likely decision-makers from Apollo and allowed public sources
- store available public person clues
- leave LinkedIn profile blank when there is no confident match
- flag `manual_linkedin_lookup_needed` when no confident profile is available
- generate:
  - connection request copy
  - short DM copy
  - follow-up DM copy

This improves multichannel execution without crossing policy or account-risk boundaries.

### Website Contact Forms

Website contact forms are allowed as a separate channel, but they must not submit silently.

Rules:

- create a form-ready company-level message
- keep this separate from Gmail approval
- only submit when the operator explicitly approves the website-form action
- track status as:
  - `pending`
  - `approved`
  - `submitted`
  - `failed`

The message may reuse the same lead magnet and pain angle as the email drafts, adapted for form length and tone.

### Phone

Phone is not a first-class workflow in v1.

Rules:

- preserve scraped phone numbers
- display them clearly in lead records
- do not build call-task orchestration yet

## Lead Magnet Delivery

Lead magnets should be hosted inside the app on a tracked asset page.

Reasons:

- better first-party tracking
- cleaner link-based engagement measurement
- easier branding control
- easier campaign-level versioning
- simpler than early HubSpot content dependency

Each hosted lead magnet page should include:

- the lead magnet content
- a clear CTA
- a booking link
- a reply path
- a request-the-audit path

Primary CTA model:

- book a call
- request the audit/teardown
- reply to the email

## Engagement And Follow-Up Engine

### Signal Ranking

The v1 high-intent hierarchy should be:

1. lead magnet click or view
2. email open
3. no engagement
4. reply stops automation and hands off to a human

### Follow-Up Behavior

Follow-up drafts should be auto-generated, but approval-gated.

Rules:

- no reply, no click, no open:
  - generate a softer bump after a longer delay
- open only:
  - generate a curiosity-based follow-up
- click/view:
  - generate a stronger, higher-priority follow-up
- reply:
  - stop draft generation for that sequence and mark human follow-up required

The trigger model should be open/click-aware rather than time-only.

## Systems Of Record

### App

The app is the source of truth for:

- batches
- leads
- contacts
- generated assets
- approval states
- multichannel action states
- follow-up states

### Gmail

Gmail is the final send surface for email.

The app should:

- create drafts
- open or sync drafts into Gmail
- track message ids where available
- use Gmail thread/reply state where possible

### Google Sheets

Google Sheets is the operator ledger, not the source of truth.

Recommended tab model:

- `Companies`
- `Contacts`
- `Drafts`
- `LinkedIn Tasks`
- `Website Forms`
- `Engagement`

This structure gives a company-first dashboard while preserving contact-level workflow detail.

### HubSpot

HubSpot should begin as an engagement mirror, not primary CRM ownership.

V1 HubSpot responsibilities:

- email engagement mirroring
- lead magnet page engagement mirroring
- reply-context visibility where possible
- follow-up-priority signals

This keeps HubSpot useful without forcing the whole system into HubSpot-first workflow design.

## Data Model Additions

The current MVP schema should be expanded with operator-facing workflow entities similar to:

- `lead_batches`
- `batch_leads`
- `linkedin_tasks`
- `website_form_submissions`
- `lead_magnet_assets`
- `asset_view_events`
- `gmail_draft_links`
- `sheet_sync_records`
- `hubspot_sync_records`
- `engagement_events`
- `follow_up_rules`
- `follow_up_instances`

The existing `companies`, `contacts`, `lead_magnets`, and `outreach_drafts` models remain central and should be extended rather than replaced.

## Approval Queue Design

The app should expose a batch-first approval queue where the operator can review:

- company summary
- evidence and pain hypothesis
- score and confidence
- all generated contacts
- one draft per contact
- LinkedIn manual task status
- website form status
- lead magnet link
- follow-up readiness

The queue should support:

- approve selected email drafts
- reject or edit drafts
- approve website-form submission separately
- mark leads for manual review
- view LinkedIn lookup-needed flags

## Product Tracks

### Track A: Batch Pipeline And Approval Queue

This is the highest-priority next build.

Includes:

- auto-run full pipeline immediately after search
- batch run records
- approval queue UI
- per-contact draft generation for all valid contacts

### Track B: Outreach Ops Surface

Includes:

- Gmail draft creation and review handoff
- Google Sheets sync
- LinkedIn manual task generation
- website-form approval and submission workflow

### Track C: Engagement And Follow-Ups

Includes:

- hosted lead magnet pages
- first-party asset-view tracking
- HubSpot engagement mirroring
- open/click-aware follow-up draft generation
- approval-gated follow-up queue

## Guardrails

- No LinkedIn scraping
- No LinkedIn automation
- No silent website-form auto-submit without explicit approval
- No auto-sending of outreach in v1
- Partial provider failures must not collapse the batch
- Company-first review, contact-level execution
- Link-based lead magnet delivery over attachment-first delivery

## Success Criteria

The design is successful when:

- a search batch can auto-run the pipeline without per-lead clicking
- every valid contact gets a draft automatically
- the operator can review the whole batch inside the app
- Gmail handles final send approval
- LinkedIn manual tasks are generated safely
- website-form submissions are separately approveable
- Google Sheets reflects operational state cleanly
- HubSpot reflects engagement signals
- follow-up drafts appear automatically based on engagement, but still require approval
