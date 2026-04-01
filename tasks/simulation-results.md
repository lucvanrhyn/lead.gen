# Pipeline Simulation Results: 5 Dentists in South Africa

**Date:** 2026-04-01
**Environment:** Production (https://leadgen-indol.vercel.app)
**Batch ID:** cmngeuht4000004lboj7puz07

---

## Discovery Summary

- **Leads requested:** 5
- **Leads found:** 5/5 (100%)
- **Source:** Google Maps Places API
- **Source confidence:** 0.93 (all leads)
- **Data quality:** All 5 leads returned with name, website, phone, full address, Google rating, and review count
- **Geographic distribution:** 4 in Cape Town, 1 in Umhlanga (Durban area)

| # | Company | Website | Location | Google Rating |
|---|---------|---------|----------|---------------|
| 1 | OptiSmile Advanced Dentistry and Implant Centre | optismile.co.za | Cape Town (Sea Point) | 4.9 (467 reviews) |
| 2 | Silver Oaks Dental Clinic | silveroaksdentalclinic.co.za | Umhlanga | 5.0 (322 reviews) |
| 3 | The Cosmetic and Dental Emporium Cape Town | capetowndentist.co.za | Cape Town (V&A Waterfront) | 4.9 (404 reviews) |
| 4 | JJS Dentistry Cape Town | jjteeth.co.za | Cape Town (V&A Waterfront) | 4.9 (337 reviews) |
| 5 | Enamel Clinic | enamel.clinic | Cape Town (De Waterkant) | 4.9 (454 reviews) |

---

## Pipeline Results (Per Lead)

### Lead 1: OptiSmile Advanced Dentistry and Implant Centre

| Field | Value |
|-------|-------|
| **Pipeline status** | READY (complete) |
| **Email found?** | No |
| **Contacts** | 1 placeholder (company name as contact name, no email) |
| **Pipeline stages completed** | 9/9 (GOOGLE_PLACES_DISCOVERY, APOLLO_COMPANY_ENRICHMENT, APOLLO_PEOPLE_ENRICHMENT [partial], FIRECRAWL_EXTRACTION, BUSINESS_CONTEXT_EXTRACTION, PAIN_HYPOTHESIS_GENERATION, LEAD_SCORING, LEAD_MAGNET_GENERATION, OUTREACH_GENERATION [partial]) |
| **Lead score** | 62/100 |
| **Score breakdown** | ICP Fit: 70, Reachability: 50, Pain Likelihood: 65, Commercial Potential: 60, Urgency: 55, Personalization: 80 |
| **Recommended action** | Nurture via phone |
| **Pain hypothesis** | Opportunity to improve lead capture efficiency given reliance on booking links and WhatsApp |
| **Pain confidence** | 0.60 |
| **Pain quality rating** | 3/5 -- reasonable but generic |
| **Lead magnet** | "OptiSmile's Website Conversion Teardown: Unlocking Patient Lead Potential" |
| **Outreach drafts** | 0 (OUTREACH_GENERATION status: PARTIAL -- no drafts saved) |
| **Outreach quality rating** | 0/5 -- no drafts generated |
| **Errors** | Apollo people search unavailable (plan limitation) |

### Lead 2: Silver Oaks Dental Clinic

| Field | Value |
|-------|-------|
| **Pipeline status** | READY (complete) |
| **Email found?** | No |
| **Contacts** | 1 placeholder (company name as contact name, no email) |
| **Pipeline stages completed** | 9/9 (same stages as Lead 1) |
| **Lead score** | 52/100 |
| **Score breakdown** | ICP Fit: 60, Reachability: 40, Pain Likelihood: 75, Commercial Potential: 40, Urgency: 50, Personalization: 55 |
| **Recommended action** | Nurture via phone |
| **Pain hypothesis** | Broken video links impacting user engagement; under-optimized digital presence |
| **Pain confidence** | 0.80 |
| **Pain quality rating** | 4/5 -- specific, evidence-based (broken media links) |
| **Lead magnet** | "Silver Oaks Dental Clinic Website Conversion Teardown" |
| **Outreach drafts** | 0 (OUTREACH_GENERATION status: PARTIAL) |
| **Outreach quality rating** | 0/5 -- no drafts generated |
| **Errors** | Apollo people search unavailable |

### Lead 3: The Cosmetic and Dental Emporium Cape Town

| Field | Value |
|-------|-------|
| **Pipeline status** | READY (complete, but APOLLO_COMPANY_ENRICHMENT failed) |
| **Email found?** | No |
| **Contacts** | 1 placeholder (company name as contact name, no email) |
| **Pipeline stages completed** | 8/9 (APOLLO_COMPANY_ENRICHMENT failed, rest succeeded) |
| **Lead score** | 56/100 |
| **Score breakdown** | ICP Fit: 70, Reachability: 40, Pain Likelihood: 71, Commercial Potential: 50, Urgency: 40, Personalization: 60 |
| **Recommended action** | Nurture via phone |
| **Pain hypothesis** | Booking/scheduling friction leading to patient dissatisfaction; pricing concerns; poor communication |
| **Pain confidence** | 0.71 |
| **Pain quality rating** | 4/5 -- grounded in customer complaints, specific |
| **Lead magnet** | "The Cosmetic and Dental Emporium Booking-Flow Optimization" |
| **Outreach drafts** | 0 (OUTREACH_GENERATION status: PARTIAL) |
| **Outreach quality rating** | 0/5 -- no drafts generated |
| **Errors** | Apollo credits exhausted; OUTREACH_GENERATION partial |

### Lead 4: JJS Dentistry Cape Town

| Field | Value |
|-------|-------|
| **Pipeline status** | ENRICHING (stuck -- GOOGLE_PLACES_DISCOVERY job locked in RUNNING state) |
| **Email found?** | Yes -- 3 generic info@ emails |
| **Contacts** | info@jjteeth.co.za, info@jjsdurbanville.co.za, info@jjsstellenbosch.co.za |
| **Pipeline stages completed** | 6/9 (FIRECRAWL, BUSINESS_CONTEXT, PAIN_HYPOTHESIS, LEAD_SCORING, LEAD_MAGNET succeeded; APOLLO_COMPANY failed; GOOGLE_PLACES stuck; no APOLLO_PEOPLE or OUTREACH) |
| **Lead score** | 54/100 |
| **Score breakdown** | ICP Fit: 40, Reachability: 10, Pain Likelihood: 70, Commercial Potential: 60, Urgency: 60, Personalization: 60 |
| **Recommended action** | Nurture via email |
| **Pain hypothesis** | Booking/scheduling inefficiency hindering high-value treatment slot occupancy |
| **Pain confidence** | 0.75 |
| **Pain quality rating** | 4/5 -- specific to treatment slot economics |
| **Lead magnet** | "JJS Dentistry Cape Town: Streamlined Booking Flow Audit" |
| **Outreach drafts** | 0 (OUTREACH_GENERATION never ran due to stuck pipeline) |
| **Outreach quality rating** | 0/5 -- no drafts generated |
| **Errors** | Apollo credits exhausted; GOOGLE_PLACES_DISCOVERY stuck in RUNNING (probable Vercel timeout); pipeline locked |

### Lead 5: Enamel Clinic

| Field | Value |
|-------|-------|
| **Pipeline status** | ENRICHING (stuck -- same GOOGLE_PLACES_DISCOVERY lock issue) |
| **Email found?** | No |
| **Contacts** | 1 placeholder (company name as contact name, no email) |
| **Pipeline stages completed** | 5/9 (FIRECRAWL, BUSINESS_CONTEXT, PAIN_HYPOTHESIS, LEAD_SCORING succeeded; APOLLO_COMPANY failed; GOOGLE_PLACES stuck; no APOLLO_PEOPLE, LEAD_MAGNET, or OUTREACH) |
| **Lead score** | 56/100 |
| **Score breakdown** | ICP Fit: 50, Reachability: 40, Pain Likelihood: 75, Commercial Potential: 55, Urgency: 50, Personalization: 60 |
| **Recommended action** | Nurture via phone |
| **Pain hypothesis** | Booking friction and patient no-shows; online visibility; patient retention |
| **Pain confidence** | 0.75 |
| **Pain quality rating** | 3/5 -- reasonable but somewhat generic |
| **Lead magnet** | None generated (LEAD_MAGNET_GENERATION never ran) |
| **Outreach drafts** | 0 |
| **Outreach quality rating** | 0/5 -- no drafts generated |
| **Errors** | Apollo credits exhausted; GOOGLE_PLACES_DISCOVERY stuck; pipeline locked |

---

## Overall Assessment

### Success Rates

| Metric | Result |
|--------|--------|
| Discovery success | 5/5 (100%) |
| Pipeline fully completed | 2/5 (40%) -- Leads 1 and 2 |
| Pipeline partially completed | 3/5 (60%) -- Leads 3, 4, 5 |
| Email found | 1/5 (20%) -- only JJS Dentistry (generic info@ emails) |
| Named contacts found | 0/5 (0%) |
| Pain hypothesis generated | 5/5 (100%) |
| Lead scoring completed | 5/5 (100%) |
| Lead magnet generated | 4/5 (80%) |
| Outreach drafts generated | 0/5 (0%) |

### Common Failure Points

1. **Apollo API credits exhausted (CRITICAL):** After processing the first 2 leads, Apollo credits ran out. Leads 3-5 all failed at APOLLO_COMPANY_ENRICHMENT. This is the single biggest blocker.

2. **OUTREACH_GENERATION producing PARTIAL with 0 drafts (CRITICAL):** Even for the 2 leads that completed the full pipeline, the OUTREACH_GENERATION stage returned PARTIAL status with zero actual outreach drafts saved to the database. This means the entire output of the pipeline -- the outreach email -- is missing for every single lead.

3. **Stale RUNNING job locks (HIGH):** Leads 4 and 5 have GOOGLE_PLACES_DISCOVERY jobs stuck in RUNNING state, which blocks any pipeline re-trigger. This is likely caused by the Vercel Hobby plan's function execution timeout killing the `after()` callback mid-execution without updating the job status.

4. **No real contacts found (HIGH):** All contacts are either placeholder entries (company name as contact name, no email) or generic info@ addresses. The Apollo People Enrichment stage failed for all 5 leads due to plan limitations.

5. **Industry classification inconsistency (LOW):** Leads 1 and 2 got industry "medical practice" from Apollo enrichment, while leads 3-5 kept "Dentists" (because Apollo failed). Minor cosmetic issue.

### Scores

| Metric | Score |
|--------|-------|
| **Data quality** | 6/10 -- Discovery data excellent, but enrichment produces placeholder contacts and no emails |
| **Pipeline reliability** | 4/10 -- 40% full completion, stuck jobs, no outreach drafts even on "successful" runs |
| **Pain hypothesis quality** | 7/10 -- Consistently specific, evidence-based, actionable angles |
| **Lead scoring quality** | 7/10 -- Component breakdowns are thoughtful and well-reasoned |
| **Outreach output quality** | 0/10 -- Zero drafts produced across all 5 leads |
| **Overall pipeline grade** | 4/10 |

### Recommendations

1. **Fix OUTREACH_GENERATION stage (P0):** This is completely broken. The stage reports PARTIAL but saves zero drafts. Investigate why the outreach drafts are not being persisted -- likely an error in the LLM call or response parsing that is being silently swallowed.

2. **Implement job timeout/cleanup (P0):** Add a mechanism to detect and reset jobs stuck in RUNNING state beyond a configurable threshold (e.g., 5 minutes). This prevents pipeline deadlocks.

3. **Add fallback email discovery (P1):** With Apollo credits exhausted and Apollo People Search unavailable on the current plan, the pipeline has no way to find emails. Consider adding Hunter.io or Snov.io as a fallback email provider, or using website scraping to extract emails from contact pages.

4. **Handle Apollo credit exhaustion gracefully (P1):** When Apollo returns "insufficient credits," the pipeline should continue without failing the overall status. Currently it marks the entire pipeline as "failed" for leads 3-5 even though most stages succeeded.

5. **Upgrade Apollo plan or add credit monitoring (P2):** The free-tier Apollo plan ran out after just 2 company enrichments. Either upgrade or add pre-flight credit checks to avoid wasted API calls.

6. **Improve contact quality (P2):** Placeholder contacts where the "contact name" is the company name provide no value. Filter these out or mark them differently. The pipeline should indicate "no contacts found" rather than creating fake entries.
