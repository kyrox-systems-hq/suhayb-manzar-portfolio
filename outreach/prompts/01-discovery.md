# Stage 1: Fresh Commercial Discovery

Serial: WEBLEADS-STAGE1-20260808-002

## Objective

Create a current commercial discovery pool for one weekly campaign.

Do not build mock-ups.
Do not draft emails.
Do not conduct deep prospect research.

The purpose of this stage is to start from businesses that appear able to pay, while making sure the source data is recent enough to trust.

## Inputs

Read:

- `outreach/config.json`
- `public/mockups/_outreach-ledger.json`
- every existing business represented under `public/mockups/`
- `outreach/campaigns/<week>/campaign.json`

Use BuiltWith as the primary structured discovery source.

## Run fresh discovery

If `BUILTWITH_API_KEY` is available:

```bash
npm run outreach:discover -- --week=<week>
```

If a BuiltWith export was supplied:

```bash
npm run outreach:discover -- --week=<week> --input=<path>
```

The discovery code must apply the same local commercial and freshness filters to API results and imported files.

## Freshness gate

BuiltWith's Lists API supports `SINCE`, and each result includes `FD` and `LD`, the first and last detected timestamps for the technology.

Use the configured 30-day recent window, but do not trust the query window alone.

Every accepted record must also pass the local `LD` gate:

- `LD` is required
- preferred: last detected within 14 days
- fallback: last detected within 30 days
- older than 30 days: reject as stale
- materially future-dated timestamps: reject as invalid

Prefer the 14-day tier when ranking the pool.

API requests must ask intermediaries not to serve cached content and must record retrieval provenance without exposing the API key. Preserve:

- retrieval run ID
- fetched-at timestamp
- BuiltWith endpoint
- `SINCE` window
- response Date header when supplied
- response Age header when supplied
- response Cache-Control when supplied
- response ETag when supplied
- payload SHA-256
- record-level `LD` age and freshness tier

For imported exports, preserve the file modification timestamp and SHA-256, while still enforcing record-level `LD` freshness.

Never reuse an old `01-discovered.json` as if it were a new pull.

## Commercial filters

Target ecommerce businesses in the US, UK and Canada.

Require the configured ranges:

- estimated monthly ecommerce sales: approximately USD 30,000 to USD 300,000
- employees: 2 to 50
- estimated monthly technology spend: at least USD 100
- ecommerce catalogue: at least the configured SKU minimum

Useful positive signals include current analytics, paid-media tooling, marketing automation, premium ecommerce tooling and traffic rank.

Revenue, employee count and technology spend are estimates. Never present them as verified facts.

## Duplicate rule

A prospect is permanently excluded if any of these match earlier work:

- business name
- trading name
- domain or redirected domain
- parent company
- owner or decision-maker
- contact email
- prior source URL
- substantially identical storefront

Do not recycle rejected prospects.

## Minimum pool

At least 25 fresh, commercially filtered, non-duplicate candidates must remain or discovery fails.

Aim for 50 so Stage 2 has enough replacement capacity.

## Live-domain recheck

Immediately after discovery, run:

```bash
npm run outreach:live-check -- --week=<week>
```

This makes a fresh no-cache request to every discovered domain, follows redirects and records the final domain, response status and check time.

A redirect into a permanently excluded domain is a duplicate.
Multiple candidates resolving to the same final storefront are duplicates.

A 2xx or 3xx response is considered live for the deterministic gate.
401, 403, 429, timeout or network-blocked responses require browser recheck in Stage 2 rather than being assumed dead.
Definitive failed statuses are not qualification candidates.

At least 25 candidates must remain after this check.

## Outputs

The machine outputs are:

- `outreach/campaigns/<week>/01-discovered.json`
- `outreach/campaigns/<week>/01-live-checked.json`

Stage 2 must start from `01-live-checked.json`, not an older cached candidate list.

Do not reject a candidate merely because an email has not yet been checked. Exact public email verification belongs to Stage 2.

End after the live-domain recheck.
