# BuiltWith Source Strategy

Serial: WEBLEADS-BUILTWITH-20260808-001

## Why the Lists API is the weekly production source

The campaign needs two things at the same time:

1. Commercial filtering before expensive research.
2. Data recent enough that the shortlist is not based on an old cached snapshot.

BuiltWith's Lists API is the primary weekly source because it supports the filters the campaign actually needs, including technology, country, recent detection window, estimated ecommerce sales revenue, employee estimate, technology-spend estimate and SKU count.

The workflow therefore uses the Lists API for the weekend batch rather than beginning from a public forum or a raw stream of newly detected domains.

## Why the Live Feed is not the primary weekly source

BuiltWith also provides a WebSocket Live Feed with real-time technology detections and rule channels such as `new`, `new-historical` and `premium`.

That feed is useful for incremental monitoring, but it does not replace the commercial shortlist. A domain can be newly detected while still having little or no revenue, which would recreate the low-value lead problem the campaign was designed to avoid.

The Live Feed can later become an optional supplementary source, particularly for detecting newly adopted ecommerce or marketing technologies, but the weekly campaign still applies the commercial Lists API filters before a business can enter qualification.

## Freshness controls around the Lists API

A production discovery run does not trust the word `recent` by itself.

It requires all of the following:

- authenticated live Lists API retrieval
- `SINCE=30 Days Ago`
- no-cache request headers
- rejection of materially stale HTTP `Age` or `Date` headers when the server supplies them
- response provenance and SHA-256 recording
- a record-level BuiltWith last-detected timestamp
- preferred ranking when last detected within 14 days
- hard rejection when last detected more than 30 days ago
- rejection of materially future-dated timestamps
- fresh direct website requests after BuiltWith discovery
- redirect deduplication against the permanent outreach ledger
- current browser verification during qualification
- current public-email source verification
- source, website and contact freshness rechecks before outbound-provider loading

A test/imported BuiltWith file can exercise the pipeline but cannot produce a production-ready send manifest.

## Commercial estimates

BuiltWith's ecommerce sales revenue and technology spend are estimates. They are used to rank and filter candidates, not represented as verified company financial results.

Stage 2 independently cross-checks commercial credibility through current public evidence before the business is accepted for expensive mock-up work.

## Future optional use of the Live Feed

If continuous lead collection becomes useful, a separate collector can subscribe to relevant ecommerce or marketing technology channels during the week and place candidate domains into a staging pool.

Those domains should still pass the normal Lists API commercial filter, duplicate gate and current-site verification before qualification.

This keeps real-time discovery as an additional signal without allowing recency to replace ability to pay.
