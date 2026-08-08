# Stage 4: Focused Mock-up Production

Serial: WEBLEADS-STAGE4-20260808-002

## Objective

Build one genuinely useful conversion concept for every qualified prospect and record exactly what the concept visibly demonstrates.

Read:

- `outreach/campaigns/<week>/03-dossiers.json`
- existing project standards
- existing mock-ups only for implementation conventions, never for prospect reuse

Write/update:

- `public/mockups/<client-slug>/`
- `outreach/campaigns/<week>/04-mockups.json`
- `public/mockups/_outreach-ledger.json`

## Build rule

The concept must demonstrate the Stage 3 commercial hypothesis.

Do not redesign an entire website merely to make it prettier.

Use only genuine public business assets and facts.

Never fabricate products, prices, discounts, reviews, claims, certifications, addresses, delivery promises, photography or logos.

## Required tests

Test approximately:

- 1440 x 1000
- 390 x 844

Audit copy hierarchy, commercial logic, visual hierarchy, mobile flow, responsive behaviour, interactions, overflow, broken assets, factual accuracy, accessibility basics, generic-template risk and whether the concept actually demonstrates the diagnosis.

Revise until it is worth sending to a paying business.

## Demonstrated improvements

After the final audit, record at least two improvements that are visibly demonstrable in the verified concept.

Each must have:

- a unique ID beginning `mockup-`, for example `mockup-hierarchy` or `mockup-delivery`
- a concise factual `claim` describing something a recipient can verify by opening the mock-up

Do not record benefits that the concept does not visibly demonstrate. Do not claim conversion or revenue improvement.

These IDs become part of the evidence bank available to Stage 6.

## Deployment

Deploy to the approved portfolio hosting route and verify the live route, assets, interactions, console, CSP, desktop and mobile rendering.

No email may be written until the live mock-up is verified.

## Exact output contract

For each prospect, `04-mockups.json` must include:

```json
{
  "business_name": "",
  "domain": "",
  "slug": "",
  "local_path": "public/mockups/.../",
  "live_url": "https://...",
  "deployment_verified": true,
  "desktop_verified": true,
  "mobile_verified": true,
  "interactions_verified": true,
  "factual_accuracy_verified": true,
  "final_intervention_summary": "",
  "demonstrated_improvements": [
    {
      "id": "mockup-hierarchy",
      "claim": ""
    },
    {
      "id": "mockup-mobile-flow",
      "claim": ""
    }
  ]
}
```

The mock-up array must contain exactly the same 25 domains as the qualified and dossier stages.
