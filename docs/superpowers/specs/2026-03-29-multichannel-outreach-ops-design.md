# Multichannel Outreach Ops Design

## Goal

Extend the lead generator from a single-lead operator tool into an app-centered, approval-first multichannel outreach system that can:

- auto-run the full lead pipeline for a discovered batch
- generate drafts for every valid contact at each company
- support manual LinkedIn outreach without LinkedIn automation
- support explicit-approval website contact-form submission
- support a Google Form diagnostic layer as a value-first qualification CTA
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
- Google Forms act as a diagnostic and qualification layer, not a generic survey system

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
8. Google Form diagnostic blueprint generation where appropriate
9. outreach draft generation for every valid contact

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

## Google Form Diagnostic Layer

### Purpose

The system should support a Google Form diagnostic layer that works alongside lead magnets and outreach.

This form is not a generic survey. It should feel like:

- a short operational diagnostic
- a bottleneck finder
- a growth or efficiency assessment
- a lead-flow or process review
- a quick business optimization check

The form should be:

- short enough to get responses
- structured enough to qualify leads
- useful enough to feel like value, not homework
- grounded in the lead's industry and pain hypothesis

### Form Strategy

The form system should generate a blueprint that has:

- a strong common base across industries
- optional industry-specific additive questions
- a short introduction
- a short closing message
- answer-type recommendations
- reasoning for each question
- short outreach CTA variants that introduce the form naturally

The system should support both:

1. a hosted lead magnet asset
2. a Google Form diagnostic

The logic should decide whether outreach uses:

- only the lead magnet
- only the form
- or both together

When both are used:

- the lead magnet gives immediate value
- the form captures deeper qualification data

### Form Sections

The generated form blueprint should include these sections:

1. Basic business context
2. Current operational situation
3. Pain points and priorities
4. Lead qualification and readiness
5. Optional open text

Question count should usually stay around 8 to 12 questions total, optimized for response rate rather than exhaustive intake.

### Required Blueprint Fields

The structured blueprint output should include:

- `form_title`
- `form_intro`
- `form_sections[]`
- `closing_message`
- `estimated_completion_time`
- `industry`
- `primary_goal`
- `qualification_strength`
- `outreach_cta_short`
- `outreach_cta_medium`

Each section should include:

- `section_name`
- `section_description`
- `questions[]`

Each question should include:

- `question_text`
- `help_text`
- `answer_type`
- `required`
- `options[]`
- `why_this_question_exists`

### Industry Adaptation

Industry-specific logic should be additive rather than a total rewrite.

Examples:

- clinics:
  - booking flow
  - cancellations
  - admin burden
  - follow-ups
- law firms:
  - intake
  - document handling
  - response time
  - matter tracking
- accountants:
  - document collection
  - client reminders
  - reporting bottlenecks
- estate agents:
  - lead response speed
  - viewing coordination
  - follow-up leakage
- home services:
  - quote requests
  - scheduling
  - dispatch
  - missed inquiries

### Google Form Lifecycle

The product should support:

- generating a Google Form blueprint from industry and pain hypothesis
- storing the blueprint in the database
- storing a live Google Form URL when one is created manually or via integration
- storing response status
- storing response summary
- storing score impact from the response

V1 does not need to fully automate form creation if that complicates delivery. It must at least support:

- blueprint generation
- copyable form structure
- a place to store the live Google Form URL
- response-status tracking
- regeneration by industry or pain hypothesis

## Channel Design

### Email

Email is the primary outbound channel.

Rules:

- generate one Gmail draft per valid contact
- drafts may share a common company-level lead magnet and core angle
- subject and body may lightly adapt by title, seniority, or confidence
- the lead magnet should be delivered as a tracked hosted link, not as a raw attachment
- outreach may include a Google Form diagnostic as a primary or secondary CTA
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

### Diagnostic Form CTA

Outreach should also support a short, friction-light Google Form CTA.

Rules:

- the form should be presented as a short diagnostic or assessment
- it must feel useful, not like homework
- it must match the lead's pain hypothesis
- it can be used as:
  - a primary CTA
  - a secondary CTA
  - a companion CTA next to the lead magnet

Example framing:

- "I put together a short 2-minute workflow diagnostic"
- "I made a quick bottleneck assessment tailored for businesses like yours"
- "I can send over a short diagnostic form to pinpoint where leads or operations are leaking"

## Engagement And Follow-Up Engine

### Signal Ranking

The v1 high-intent hierarchy should be:

1. lead magnet click or view
2. Google Form submission
3. email open
4. no engagement
5. reply stops automation and hands off to a human

### Follow-Up Behavior

Follow-up drafts should be auto-generated, but approval-gated.

Rules:

- no reply, no click, no open:
  - generate a softer bump after a longer delay
- open only:
  - generate a curiosity-based follow-up
- click/view:
  - generate a stronger, higher-priority follow-up
- diagnostic form submission:
  - increase qualification confidence
  - increase urgency or serviceability where the answers justify it
  - generate a more specific follow-up draft
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
- form blueprints
- form links
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
- `Forms`
- `LinkedIn Tasks`
- `Website Forms`
- `Engagement`

This structure gives a company-first dashboard while preserving contact-level workflow detail.

### HubSpot

HubSpot should begin as an engagement mirror, not primary CRM ownership.

V1 HubSpot responsibilities:

- email engagement mirroring
- lead magnet page engagement mirroring
- diagnostic form engagement mirroring where feasible
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
- `diagnostic_form_blueprints`
- `diagnostic_form_links`
- `diagnostic_form_responses`
- `asset_view_events`
- `gmail_draft_links`
- `sheet_sync_records`
- `hubspot_sync_records`
- `engagement_events`
- `follow_up_rules`
- `follow_up_instances`

The existing `companies`, `contacts`, `lead_magnets`, and `outreach_drafts` models remain central and should be extended rather than replaced.

Form responses should also be able to influence lead scoring. Examples:

- urgency answers increase urgency score
- budget comfort improves qualification confidence
- clear pain articulation improves serviceability
- detailed workflow answers strengthen pain-evidence quality

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
- diagnostic form blueprint and live form URL
- follow-up readiness

The queue should support:

- approve selected email drafts
- reject or edit drafts
- approve website-form submission separately
- generate or regenerate diagnostic forms
- copy Google Form structure
- store and edit the live Google Form URL
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
- diagnostic form blueprint generation per lead where relevant

### Track B: Outreach Ops Surface

Includes:

- Gmail draft creation and review handoff
- Google Sheets sync
- LinkedIn manual task generation
- website-form approval and submission workflow
- Google Form blueprint review, copy, and URL storage workflow

### Track C: Engagement And Follow-Ups

Includes:

- hosted lead magnet pages
- first-party asset-view tracking
- diagnostic form response capture and score impact
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
- Diagnostic forms must feel like short business assessments, not academic surveys

## Success Criteria

The design is successful when:

- a search batch can auto-run the pipeline without per-lead clicking
- every valid contact gets a draft automatically
- the operator can review the whole batch inside the app
- Gmail handles final send approval
- LinkedIn manual tasks are generated safely
- website-form submissions are separately approveable
- diagnostic forms are generated, reviewable, and attachable to outreach
- Google Sheets reflects operational state cleanly
- HubSpot reflects engagement signals
- follow-up drafts appear automatically based on engagement, but still require approval
