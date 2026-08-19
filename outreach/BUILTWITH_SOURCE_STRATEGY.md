# BuiltWith Source Strategy

Serial: WEBLEADS-BUILTWITH-20260808-002

## Operating principle

The user is not part of the data-collection pipeline.

The system must not require them to open BuiltWith, export a report, copy rows or run a query on the agent's behalf.

## Primary no-user source: current public BuiltWith lists

BuiltWith publicly exposes current technology and technology-combination lists that show useful commercial ranking fields, including estimated ecommerce sales revenue, estimated technology spend, product count, employee estimate where available, followers and traffic rank.

The public list pages also identify themselves as current/live and display a `Last Updated` statement.

The research agent can therefore gather the weekly raw candidate pool directly from BuiltWith's public web pages without Lists API entitlement and without making the user act as a data courier.

Useful source families include:

- Shopify website list
- Shopify + Klaviyo
- Shopify + Facebook/Meta Pixel
- Shopify + Google advertising/conversion tooling
- Shopify + Hotjar
- Shopify + Judge Me
- Shopify + Trustpilot
- Shopify + Gorgias
- Shopify + Recharge Payments
- other commercially useful combinations discovered during the weekly run

A campaign should use multiple distinct source pages rather than relying on one list.

## Public-source production controls

A public BuiltWith discovery can be production eligible only when:

- the pages are directly fetched during the current campaign build
- at least four distinct BuiltWith public pages contribute to the source set
- the source-page fetch timestamps are within the configured 24-hour window
- exact BuiltWith source URLs are retained
- the page's current/live status and displayed `Last Updated` claim are recorded
- each candidate retains the exact public page from which its commercial fields were read
- hard commercial filters are applied locally
- existing ledger candidates are excluded
- every discovered business receives a separate fresh live-domain/redirect check
- Stage 2 independently resolves missing business-size information
- Stage 2 independently verifies the website and exact public contact email
- website and contact verification are rechecked for freshness before outbound loading

A previous campaign's discovery file cannot be recycled as a new production pull.

## Optional Lists API route

The BuiltWith Lists API remains supported when entitlement is available.

It is useful because it can provide a larger structured candidate set and record-level detection timestamps in one request. When used, the system applies no-cache response checks, records payload provenance and hashes, prefers last-detected ages within 14 days and rejects records older than 30 days.

But Lists API entitlement is **not a prerequisite** for operating the weekly campaign.

If the user's BuiltWith account does not expose the Lists API, the agent simply uses the public BuiltWith route instead. The user does not need to upgrade, export data or perform manual steps for the agent.

## Why not rely only on the Domain API

The Domain API is useful for enriching a domain we already know, but it does not solve the primary discovery problem by itself because it begins from a domain lookup.

The campaign therefore discovers commercially interesting domains from BuiltWith's current public lists or, when available, the Lists API. Domain-level data can be used later as optional enrichment.

## Commercial filtering

The public and API routes converge on the same commercial model:

- US, UK and Canada
- estimated ecommerce sales approximately USD 30,000 to USD 300,000 per month
- estimated technology spend at least USD 100 per month
- meaningful ecommerce catalogue
- preferably 2 to 50 employees
- positive investment signals such as marketing automation, paid-media tooling, analytics, CRO or support technology

If employee count is absent from a public row, the candidate may survive Stage 1 but business size must be resolved independently before qualification.

BuiltWith's commercial figures are estimates and are never represented as verified turnover or headcount.

## Freshness is multi-layered

The public list saying it is current is useful, but it is not sufficient by itself.

The workflow deliberately layers freshness checks:

1. current BuiltWith public source fetched during the campaign, or fresh Lists API retrieval
2. hard local commercial filters and permanent duplicate exclusions
3. direct no-cache live-domain request and redirect resolution
4. current desktop/mobile browser inspection
5. current public-email source verification
6. source/site/contact freshness recheck before outbound provider loading

This means a stale or abandoned business should be removed even if it happens to remain visible in a BuiltWith source.

## Optional live feed

BuiltWith's real-time technology feed may later be used as an incremental monitoring signal, but it should not replace commercial filtering. Newly detected technology does not by itself prove ability to pay.
