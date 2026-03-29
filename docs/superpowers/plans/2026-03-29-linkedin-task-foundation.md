# LinkedIn Task Foundation Implementation Plan

**Goal:** Add a safe manual LinkedIn workflow layer so each generated outreach draft produces a corresponding LinkedIn task with operator-ready copy and an explicit lookup-needed state.

**Architecture:** Persist one `LinkedInTask` per outreach draft. Generate the task alongside the email draft so the channel stays aligned by contact and campaign angle. Surface the task in the lead detail view as a manual action aid, not an automation layer.

**Scope for this slice:**
- schema for LinkedIn tasks and statuses
- LinkedIn task generation helper
- persistence alongside outreach draft creation
- lead detail repository loading
- UI surfacing in a dedicated LinkedIn tab
- seed/demo coverage and tests

**Non-goals for this slice:**
- LinkedIn scraping
- LinkedIn automation
- browser automation for LinkedIn
- live profile matching beyond existing contact data
