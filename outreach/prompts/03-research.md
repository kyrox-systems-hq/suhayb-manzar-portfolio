# Stage 3: Prospect Research and Commercial Diagnosis

Serial: WEBLEADS-STAGE3-20260807-002

## Objective

Understand each of the 25 qualified businesses well enough to choose one demonstrable website intervention.

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

Keep source URLs for factual claims and preserve the evidence in the dossier.

## Diagnosis

For each prospect choose exactly one primary commercial problem and exactly one conversion surface.

Explain:

- what is visibly weak
- the evidence supporting that conclusion
- why it may matter commercially without inventing conversion rates or lost revenue
- what the mock-up should change
- which genuine public business assets can safely be used
- two to four distinct observations that can later support different email touches

Valid conversion surfaces include homepage, product page, collection page, paid-ad landing page, booking flow, quote request and lead-generation page.

## Exact output contract

`03-dossiers.json` must use this structure:

```json
{
  "schema_version": 1,
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
      "outreach_relevant_observations": ["", ""]
    }
  ]
}
```

The dossier array must contain exactly the same 25 domains as `02-qualified.json`.

## Quality gate

Reject and replace a prospect if deeper research reveals that the problem is not meaningful, the business is weaker than qualification suggested, factual evidence cannot support a credible intervention, or the contact/compliance basis is no longer sound.

If a replacement is required, return to Stage 2, record the rejection, qualify a replacement, sync the ledger, and then regenerate the 25-domain dossier set. Never allow the campaign to drop below 25 or allow Stage 3 to contain a different domain set from Stage 2.
