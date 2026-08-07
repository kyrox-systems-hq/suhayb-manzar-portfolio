# Stage 3: Prospect Research and Commercial Diagnosis

Serial: WEBLEADS-STAGE3-20260808-003

## Objective

Understand each of the 25 qualified businesses well enough to choose one demonstrable website intervention and create a sourced evidence bank for later outreach.

Read:

- `outreach/campaigns/<week>/02-qualified.json`

Write:

- `outreach/campaigns/<week>/03-dossiers.json`

Do not write outreach emails yet.

## Research each business

Inspect the current website and relevant pages on desktop and mobile.

Research only what improves the commercial diagnosis:

- business model
- positioning
- target customer
- flagship or strategically important products
- active advertising where visible
- acquisition landing pages
- product and collection pages
- navigation
- trust information
- shipping and returns
- purchase or enquiry flow
- public customer feedback
- current company developments
- recipient role and responsibilities where publicly evidenced

Keep source URLs for every fact that may later appear in an outreach email.

## Diagnosis

For each prospect choose exactly one primary commercial problem and exactly one conversion surface.

Explain:

- what is visibly weak
- the evidence supporting that conclusion
- why it may matter commercially without inventing conversion rates or lost revenue
- what the mock-up should change
- which genuine public business assets can safely be used

## Evidence bank

Create at least three prospect-specific sourced evidence items.

Each evidence item must have:

- a unique stable ID such as `site-1`, `ads-1`, `business-1` or `customer-1`
- a concise factual `claim`
- one or more public `source_urls`
- a `type`, for example website_observation, business_fact, advertising_signal, customer_feedback or contact_context

Only put a claim in the evidence bank when the cited public source supports it.

The email-writing stage may only cite evidence IDs from this bank plus the verified mock-up evidence created in Stage 4.

## Exact output contract

`03-dossiers.json` must use this structure:

```json
{
  "schema_version": 2,
  "campaign_week": "YYYY-MM-DD",
  "dossiers": [
    {
      "business_name": "",
      "domain": "",
      "primary_commercial_problem": "",
      "evidence": [""],
      "source_urls": ["https://..."],
      "why_it_matters": "",
      "chosen_conversion_surface": "",
      "intervention_hypothesis": "",
      "genuine_assets_available": [""],
      "outreach_relevant_observations": ["", ""],
      "evidence_bank": [
        {
          "id": "site-1",
          "type": "website_observation",
          "claim": "",
          "source_urls": ["https://..."]
        }
      ]
    }
  ]
}
```

The dossier array must contain exactly the same 25 domains as `02-qualified.json`.

## Quality gate

Reject and replace a prospect if deeper research reveals that the problem is not meaningful, the business is weaker than qualification suggested, factual evidence cannot support a credible intervention, or the contact/compliance basis is no longer sound.

If a replacement is required, return to Stage 2, record the rejection, qualify a replacement, sync the ledger, and then regenerate the 25-domain dossier set. Never allow the campaign to drop below 25 or allow Stage 3 to contain a different domain set from Stage 2.
