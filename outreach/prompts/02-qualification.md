# Stage 2: Qualification, Freshness and Contact Gate

Serial: WEBLEADS-STAGE2-20260808-003

## Objective

Turn the fresh Stage 1 pool into exactly 25 prospects worth paying implementation effort for.

Read:

- `outreach/config.json`
- `public/mockups/_outreach-ledger.json`
- `outreach/campaigns/<week>/01-discovered.json`
- `outreach/campaigns/<week>/01-live-checked.json`

Write:

- `outreach/campaigns/<week>/02-qualified.json`

Do not build a mock-up and do not write outreach in this stage.

Start from `01-live-checked.json`. Never substitute an older candidate list.

## Evaluate candidates until exactly 25 pass

### Freshness and live-business gate

For each serious candidate:

- preserve the BuiltWith `last_detected_at`, discovery age and freshness tier
- open the current website in a browser on desktop and mobile
- follow any redirect and confirm the final storefront/business identity
- if the deterministic live check was blocked, timed out or rate-limited, resolve it manually in the browser
- record a fresh browser verification timestamp
- confirm the business is actively trading and the relevant ecommerce surface is currently accessible

The browser/site verification used for final qualification must be no older than the configured `qualification.live_site_check_max_age_hours` at campaign preflight.

Reject stale, abandoned, parked, sold, redirected-to-an-excluded-business or unverifiable candidates.

### Commercial credibility

Verify that each store is active and plausibly within the intended commercial range. Cross-check BuiltWith estimates where useful using current catalogue activity, active advertising, traffic evidence, LinkedIn headcount, company filings, social activity and current marketing technology.

BuiltWith revenue, employee and technology-spend values are estimates. Never present them as verified turnover, headcount or spend.

### Website opportunity

Inspect the current website on desktop and mobile. A selected prospect must have at least one commercially meaningful problem that could justify paid implementation work.

Examples include weak mobile product flow, poor landing-page relevance, confusing hierarchy, weak trust architecture, delivery or returns information buried near purchase, poor navigation, weak CTA structure, slow or unstable experience, weak offer communication, outdated presentation relative to the business, material accessibility friction or paid traffic landing on an unsuitable conversion surface.

Reject sites where our intervention would be marginal.

### Exact public email gate

A prospect cannot qualify without an exact email address explicitly published in a public source.

Accepted sources include the official website, official company profile, company filing, verified social profile, recognised business directory or the person's own public post.

Never infer, guess or pattern-generate an address.

Open the email source during this stage and record when it was checked. Do not rely on an old email copied from BuiltWith metadata or an earlier campaign without re-verifying the public source.

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
  "schema_version": 2,
  "campaign_week": "YYYY-MM-DD",
  "prospects": [
    {
      "business_name": "",
      "domain": "",
      "country": "US|UK|CA",
      "location": "",
      "timezone": "IANA timezone",
      "builtwith_signals": {},
      "builtwith_last_detected_at": "ISO timestamp",
      "builtwith_last_detected_age_days_at_discovery": 0,
      "builtwith_freshness_tier": "preferred|fallback",
      "live_site_checked_at": "ISO timestamp",
      "live_site_status": "active",
      "live_site_final_url": "https://...",
      "live_site_final_domain": "",
      "live_site_evidence_urls": ["https://..."],
      "commercial_verification_notes": "",
      "primary_website_problem": "",
      "problem_evidence": [],
      "best_conversion_surface": "",
      "recipient_name": "",
      "recipient_role": "",
      "contact_email": "",
      "email_source_url": "https://...",
      "contact_email_verified_at": "ISO timestamp",
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

Do not proceed to Stage 3 until the file contains exactly 25 qualified prospects, every freshness/contact gate is evidenced and the ledger sync succeeds.
