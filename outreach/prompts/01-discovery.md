# Stage 1: Fresh Commercial Discovery

Serial: WEBLEADS-STAGE1-20260808-003

## Objective

Create a current commercial discovery pool for one weekly campaign without making the user act as a data courier.

Do not build mock-ups.
Do not draft emails.
Do not conduct deep prospect research.

The purpose of this stage is to start from businesses that appear able to pay, while independently obtaining and verifying the source data.

## Non-negotiable operating rule

**Never ask the user to open BuiltWith pages, export a CSV, paste results, run a query or collect candidate data for this workflow.**

The research agent must obtain the BuiltWith discovery data itself.

## Inputs

Read:

- `outreach/config.json`
- `public/mockups/_outreach-ledger.json`
- every existing business represented under `public/mockups/`
- `outreach/campaigns/<week>/campaign.json`

## Preferred no-user discovery route: BuiltWith public current lists

Use direct current BuiltWith public pages such as:

- Shopify website lists
- Shopify + Klaviyo
- Shopify + Meta/Facebook Pixel
- Shopify + Google Ads conversion tooling
- Shopify + Hotjar
- Shopify + Judge Me
- Shopify + Trustpilot
- Shopify + Gorgias
- Shopify + Recharge Payments
- other commercially useful Shopify technology combinations

Use at least four distinct current BuiltWith pages for a campaign and preferably several complementary technology pages so the pool is commercially diverse.

The public lists expose commercial fields such as sales-revenue estimate, technology-spend estimate, product count, employee estimate when available, follower signals and traffic rank. They also state their update status on the live page.

For every source page record:

- exact BuiltWith public URL
- direct fetch timestamp
- whether the page identifies the list as current/live
- the displayed `Last Updated` claim

For every candidate record:

- business/domain
- country
- ecommerce platform signal
- displayed estimated monthly sales revenue
- displayed estimated monthly technology spend
- displayed product/SKU count
- employee estimate when shown
- followers/traffic rank when shown
- the exact BuiltWith public source URL containing that candidate

Create a private operational JSON input and run:

```bash
npm run outreach:public-builtwith -- --week=<week> --input=<private-agent-generated-file>
```

This file is operational working data and must not be committed to the public repository.

No user action is required.

## Optional Lists API route

If a Lists API credential is already available to the agent environment, it may instead run:

```bash
npm run outreach:discover -- --week=<week>
```

The Lists API is an optimisation, not a dependency. Do not stop or ask the user to obtain Lists API access when the public BuiltWith route is available.

A manually supplied BuiltWith export is supported only for tests and must never be requested from the user as part of normal operation.

## Freshness gate

### Public BuiltWith route

Public-source evidence must be fetched directly during the current campaign build.

Require:

- at least four distinct BuiltWith public source pages
- source-page age no greater than the configured 24-hour limit
- direct BuiltWith URL provenance
- BuiltWith's current/live list indication and displayed `Last Updated` claim
- a separate fresh no-cache request to the discovered business after BuiltWith discovery
- current browser inspection during Stage 2
- current exact-public-email verification during Stage 2

Never reuse last week's public candidate file as a fresh discovery run.

### Lists API route

When the Lists API is used, retain its stronger record-level controls:

- fresh retrieval run ID
- `SINCE` window
- response provenance and payload hashes
- no-cache request headers
- response Age/Date checks when supplied
- record-level last-detected timestamp
- preferred last detected within 14 days
- hard rejection above 30 days
- rejection of materially future-dated timestamps

## Commercial filters

Target ecommerce businesses in the US, UK and Canada.

Require:

- estimated monthly ecommerce sales: approximately USD 30,000 to USD 300,000
- estimated monthly technology spend: at least USD 100
- ecommerce catalogue: at least the configured SKU minimum
- employees: preferably 2 to 50

If BuiltWith's public row does not show an employee estimate, do not discard an otherwise strong candidate during Stage 1. Mark the employee estimate as unknown and resolve business size independently during Stage 2. If an employee estimate is shown and is outside the configured range, reject it.

Useful positive signals include Klaviyo, paid-media tooling, analytics, Hotjar, premium ecommerce apps, review systems, support tooling and meaningful traffic rank.

BuiltWith commercial values are estimates. Never present them as verified financial results or headcount.

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

At least 25 current, commercially filtered, non-duplicate candidates must remain or discovery fails.

Aim for approximately 50 so Stage 2 has enough replacement capacity. If one public list does not yield enough qualifying candidates, continue through additional BuiltWith public technology-combination pages. Do not lower the commercial thresholds merely to reach 50.

## Live-domain recheck

Immediately after discovery, run:

```bash
npm run outreach:live-check -- --week=<week>
```

This makes a fresh no-cache request to every discovered domain, follows redirects and records the final domain, response status and check time.

A redirect into a permanently excluded domain is a duplicate. Multiple candidates resolving to the same final storefront are duplicates.

A 2xx or 3xx response is considered live for the deterministic gate. 401, 403, 429, timeout or network-blocked responses require browser recheck in Stage 2 rather than being assumed dead. Definitive failed statuses are not qualification candidates.

At least 25 candidates must remain after this check.

## Outputs

The machine outputs are:

- `outreach/campaigns/<week>/01-discovered.json`
- `outreach/campaigns/<week>/01-live-checked.json`

Stage 2 must start from `01-live-checked.json`, not an older candidate list.

Do not reject a candidate merely because an email has not yet been checked. Exact public email verification belongs to Stage 2.

End after the live-domain recheck.
