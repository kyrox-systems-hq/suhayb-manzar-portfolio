# Stage 2: Qualification and Contact Gate

Serial: WEBLEADS-STAGE2-20260807-001

## Objective

Turn the discovery pool into exactly 25 prospects that are worth paying implementation effort for.

Read:

- `outreach/config.json`
- `public/mockups/_outreach-ledger.json`
- `outreach/campaigns/<week>/01-discovered.json`

Write:

`outreach/campaigns/<week>/02-qualified.json`

## Evaluate each candidate

### 1. Commercial credibility

Verify that the store is live, active and plausibly within the intended commercial range.

Use independent signals where useful:

- current product catalogue
- current social activity
- Meta Ad Library
- Google Ads Transparency Center
- Similarweb or equivalent traffic evidence
- LinkedIn headcount
- company filings
- current marketing technologies

Treat BuiltWith revenue and employee values as estimates.

### 2. Website opportunity

Inspect the website on desktop and mobile.

A prospect must have at least one meaningful commercial problem such as:

- weak mobile product-page flow
- poor landing-page relevance
- confusing product hierarchy
- weak trust architecture
- delivery or returns information buried near purchase
- poor navigation
- weak CTA structure
- slow or unstable page experience
- poor offer communication
- outdated presentation relative to the business
- accessibility issue that materially affects use
- paid traffic landing on an unsuitable conversion surface

Reject sites where our intervention would be marginal.

### 3. Exact public email gate

A prospect cannot qualify without an exact email address explicitly published in a public source.

Accepted sources include:

- official company website
- official company profile
- company filing
- verified social profile
- recognised business directory
- the person's own public post

Do not infer, guess or pattern-generate an address.

Record:

- recipient name
- role
- exact email
- email source URL
- business location
- timezone

Prefer a founder, owner, ecommerce lead, marketing lead or relevant decision-maker. An official business inbox may be used where appropriate.

### 4. Compliance gate

Record a defensible outreach basis for the recipient's jurisdiction.

US:
- mark CAN-SPAM requirements for the eventual message

UK:
- verify corporate-subscriber status or another suitable basis
- do not treat sole traders and protected partnerships as corporate subscribers

Canada:
- record the specific CASL consent basis
- where relying on conspicuous publication, preserve evidence that the address was conspicuously published, no no-solicitation statement accompanied it, and the outreach is relevant to the recipient's business role

Australia:
- exclude by default unless a specific consent basis is verified

A public email address alone is not a universal compliance basis.

### 5. Score

Score from 0 to 10 using the configured weights:

- ability to pay
- website opportunity
- commercial urgency
- marketing-spend evidence
- decision-maker accessibility

## Replacement rule

Continue evaluating and replacing failures until exactly 25 pass.

For every seriously evaluated candidate, update `public/mockups/_outreach-ledger.json`.

Rejected candidates must remain permanently recorded with a reason such as:

- no_verified_email
- duplicate
- low_value
- stale
- unverifiable_business
- weak_commercial_case
- compliance_basis_unverified

## Required qualified record

Every selected record must contain:

- business_name
- domain
- country
- location
- timezone
- builtwith signals
- commercial verification notes
- primary website problem
- problem evidence
- best conversion surface
- recipient name
- recipient role
- exact contact email
- email source URL
- compliance status
- compliance basis
- compliance evidence URLs
- five component scores
- weighted score

Do not build anything yet.
