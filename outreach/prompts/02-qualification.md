# Stage 2: Qualification and Contact Gate

Serial: WEBLEADS-STAGE2-20260807-002

## Objective

Turn the Stage 1 discovery pool into exactly 25 prospects worth paying implementation effort for.

Read:

- `outreach/config.json`
- `public/mockups/_outreach-ledger.json`
- `outreach/campaigns/<week>/01-discovered.json`

Write:

- `outreach/campaigns/<week>/02-qualified.json`

Do not build a mock-up and do not write outreach in this stage.

## Evaluate candidates until exactly 25 pass

### Commercial credibility

Verify that each store is live, active and plausibly within the intended commercial range. Cross-check BuiltWith estimates where useful using current catalogue activity, advertising, traffic evidence, LinkedIn headcount, company filings, social activity and the live technology stack.

BuiltWith revenue and employee values are estimates and must never be presented as verified turnover or headcount.

### Website opportunity

Inspect the current website on desktop and mobile. A selected prospect must have at least one commercially meaningful problem that could justify paid implementation work.

Examples include weak mobile product flow, poor landing-page relevance, confusing hierarchy, weak trust architecture, delivery or returns information buried near purchase, poor navigation, weak CTA structure, slow or unstable experience, weak offer communication, outdated presentation relative to the business, material accessibility friction or paid traffic landing on an unsuitable conversion surface.

Reject sites where our intervention would be marginal.

### Exact public email gate

A prospect cannot qualify without an exact email address explicitly published in a public source.

Accepted sources include the official website, official company profile, company filing, verified social profile, recognised business directory or the person's own public post.

Never infer, guess or pattern-generate an address.

Prefer a founder, owner, ecommerce lead, marketing lead or relevant decision-maker. An official business inbox may be used where appropriate.

### Compliance gate

Record a defensible outreach basis for the recipient's jurisdiction.

US:
- record the CAN-SPAM requirements that will govern the message

UK:
- verify corporate-subscriber status or another suitable basis
- do not treat sole traders and protected partnerships as corporate subscribers

Canada:
- record the specific CASL consent basis
- where relying on conspicuous publication, preserve evidence that the address was conspicuously published, no no-solicitation statement accompanied it, and the outreach is relevant to the recipient's business role

Australia:
- exclude by default unless a specific consent basis is verified and the campaign configuration is intentionally changed

A public email address alone is not a universal compliance basis.

### Score

Score every selected prospect from 0 to 10 for:

- ability_to_pay
- website_opportunity
- commercial_urgency
- marketing_spend_evidence
- decision_maker_accessibility

Calculate `weighted_score` using `outreach/config.json`.

## Exact output contract

`02-qualified.json` must use this structure:

```json
{
  "schema_version": 1,
  "campaign_week": "YYYY-MM-DD",
  "prospects": [
    {
      "business_name": "",
      "domain": "",
      "country": "US|UK|CA",
      "location": "",
      "timezone": "IANA timezone",
      "builtwith_signals": {},
      "commercial_verification_notes": "",
      "primary_website_problem": "",
      "problem_evidence": [],
      "best_conversion_surface": "",
      "recipient_name": "",
      "recipient_role": "",
      "contact_email": "",
      "email_source_url": "https://...",
      "compliance_status": "eligible",
      "compliance_basis": "",
      "compliance_evidence_urls": ["https://..."],
      "scores": {
        "ability_to_pay": 0,
        "website_opportunity": 0,
        "commercial_urgency": 0,
        "marketing_spend_evidence": 0,
        "decision_maker_accessibility": 0,
        "weighted_score": 0
      }
    }
  ],
  "rejected": [
    {
      "business_name": "",
      "domain": "",
      "recipient_name": null,
      "recipient_role": null,
      "contact_email": null,
      "email_source_url": null,
      "source_post_url": null,
      "source_platform": "BuiltWith-led discovery",
      "rejection_reason": "no_verified_email|duplicate|low_value|stale|unverifiable_business|weak_commercial_case|compliance_basis_unverified",
      "notes": ""
    }
  ]
}
```

`prospects` must contain exactly 25 records.

`rejected` must contain every seriously evaluated candidate that failed after Stage 1. Never silently discard a serious evaluation.

## Persistent ledger

After writing `02-qualified.json`, run:

```bash
npm run outreach:ledger-sync -- --week=<week>
```

This persists both qualified and rejected candidates in `public/mockups/_outreach-ledger.json` so they cannot be reconsidered later.

Do not proceed to Stage 3 until the file contains exactly 25 qualified prospects and the ledger sync succeeds.
