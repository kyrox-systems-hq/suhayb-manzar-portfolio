# Outreach System Test Report

Serial: WEBLEADS-TEST-20260808-002

Tested and hardened: 7 to 8 August 2026

## Verdict

The first implementation did not behave exactly as intended. Failure-oriented testing exposed weaknesses in commercial import filtering, duplicate handling, source freshness, stage integrity, evidence grounding, scheduling, ledger persistence and outbound safety.

Those weaknesses were hardened and the deterministic campaign core was re-run successfully in isolated local fixtures.

The system now deliberately refuses to treat a BuiltWith export as a production source. A real campaign must start from a fresh authenticated BuiltWith Lists API pull and must pass fresh website, contact, evidence, campaign and provider gates before activation.

No real prospect was contacted during testing.

## Current production model

- campaign size: exactly 25 qualified prospects
- initial raw target: approximately 50 fresh commercially filtered prospects
- touches per prospect: exactly 5
- planned messages: exactly 125
- new prospects per recipient working date: maximum 5
- follow-up gap: exactly 3 recipient business days after the preceding touch
- BuiltWith production source: authenticated live Lists API only
- BuiltWith pull maximum age at production qualification/provider loading: 48 hours
- preferred BuiltWith last-detected age: 14 days or less
- maximum BuiltWith last-detected age: 30 days
- browser live-site verification maximum age: 24 hours
- public email verification maximum age: 24 hours
- test/import data cannot become a production-ready manifest

## BuiltWith freshness and cache tests

Passed after hardening:

- `SINCE=30 Days Ago` is used for the Lists API recent query
- every accepted record requires a BuiltWith last-detected timestamp
- records last detected more than 30 days ago are rejected
- records materially future-dated are rejected
- records detected within 14 days receive the preferred freshness tier
- 14 to 30 day records remain fallback candidates
- API requests ask intermediaries not to serve cached content
- a supplied HTTP `Age` header above the configured cache threshold causes the BuiltWith response to be rejected
- a supplied materially stale HTTP `Date` header causes the BuiltWith response to be rejected
- API page retrieval time, response Date, Age, Cache-Control, ETag where available and payload SHA-256 are preserved without exposing the API key
- imported BuiltWith data is locally freshness-filtered but explicitly marked non-production
- production source preflight refuses a BuiltWith export
- production source preflight refuses a BuiltWith pull older than the configured 48-hour limit
- live-domain evidence is cryptographically tied to the same discovery retrieval run

The current production design therefore does not rely on `SINCE` alone to decide whether data is current.

## Commercial discovery tests

Passed:

- existing ledger domain excluded
- existing ledger business name excluded
- existing ledger contact email excluded
- within-run domain duplicate excluded
- within-run business-name duplicate excluded
- within-run email duplicate excluded
- revenue below configured range excluded
- employee count below configured range excluded
- technology spend below configured minimum excluded
- SKU count below configured minimum excluded
- country outside configured campaign markets excluded
- imported data receives the same local commercial filters as API data
- discovery refuses to proceed with fewer than 25 viable records

The expanded freshness fixture contained 30 valid current records plus deliberate failures. All deliberately stale, duplicate and commercially out-of-range records were removed while the 30 valid records survived.

## Current-domain and redirect tests

A separate live-domain stage now rechecks every discovered site independently of BuiltWith.

Passed:

- every discovery candidate receives a fresh no-cache HTTP request
- redirects are followed and final domains recorded
- a redirect into a permanently excluded ledger domain is rejected as a duplicate
- two candidate domains resolving to the same final storefront are deduplicated
- 2xx and 3xx responses pass the deterministic live gate
- 401, 403 and 429 responses are quarantined for browser recheck rather than assumed dead
- timeout/network-blocked responses are quarantined for browser recheck
- definitive failed statuses are removed from the qualification pool
- the stage fails when fewer than 25 qualification candidates remain

In the local liveness fixture, 30 records were checked. A deliberate same-store redirect was removed, one 403 was flagged for browser recheck, one 500 was removed, and 28 qualification candidates remained.

## Qualification freshness tests

Passed:

- a qualified prospect must originate from the current live-checked discovery run
- BuiltWith last-detected timestamp and freshness tier must match the current discovery record
- current business location and valid IANA timezone are required
- browser site verification must be freshly timestamped
- browser verification older than 24 hours is rejected
- browser-verified final domain must match the qualified domain
- current live-site evidence URLs are required
- exact public email source is required
- public email verification must be freshly timestamped
- public email verification older than 24 hours is rejected
- commercial verification notes, primary website problem, problem evidence and conversion surface are required
- compliance status, basis and evidence URLs are required
- all component scores are required
- duplicate qualified contact emails are rejected
- non-configured countries are rejected

This prevents a business or contact verified early in the weekend build from silently becoming stale before activation.

## Permanent ledger tests

Passed:

- qualified prospects are persisted
- seriously evaluated rejected prospects are persisted
- `no_verified_email` is preserved as a permanent rejection reason
- previous ledger entries remain intact
- a qualified prospect that collides with a previous campaign by permanent domain is rejected rather than silently skipped
- same-campaign ledger synchronisation is idempotent and does not create duplicate entries

A targeted test using `patchandbagel.com` under a different business alias failed as expected because the domain already exists in the permanent ledger.

## Research and evidence-grounding tests

The research handoff now contains a sourced evidence bank, and the mock-up handoff contains separately verified demonstrated-improvement evidence.

Passed:

- every dossier requires at least three sourced evidence-bank items
- evidence IDs must be unique and structurally valid
- dossier evidence claims require public source URLs
- every mock-up requires at least two `mockup-*` demonstrated-improvement records
- sequence copy may reference only known dossier or mock-up evidence IDs
- a made-up evidence ID causes preflight failure
- all five touches together must use at least four distinct grounded evidence items
- recorded email `word_count` must exactly equal the final body
- a deliberately wrong word count causes preflight failure
- highly repetitive touch copy is rejected by similarity checking

This closes the gap where a sequence could previously claim to be personalised while merely recording free-form evidence notes that were never tied back to source material.

## Sequence tests

Passed:

- exactly 5 touches are required
- touch numbers must be 1 through 5 in order
- initial subject is required
- follow-ups retain the original thread subject
- initial and follow-up word limits are enforced
- en dash and em dash characters are rejected
- generic low-value language such as `just following up` is rejected
- every touch requires a distinct purpose
- sequence recipient details must match the qualified record
- sequence mock-up URL must match the verified deployment record
- Touch 1 must include the verified live mock-up URL
- every touch must use grounded evidence IDs

Deliberate generic, evidence-free, unknown-evidence and word-count-error variants all failed preflight as expected.

## Source and campaign preflight integrity

Passed:

- source freshness preflight must pass before campaign preflight can become actionable
- source preflight hashes the current discovery and live-domain files
- campaign preflight hashes live-domain, qualification, dossier, mock-up, email-standard and sequence files
- changing discovery after source preflight invalidates scheduling
- changing live-domain evidence after preflight invalidates scheduling
- changing any protected downstream campaign stage after validation invalidates scheduling
- test/import source preflight cannot be used to schedule a production manifest

This prevents a validated campaign from being modified quietly between review and scheduling.

## Scheduling tests

Passed:

- 25 prospects produce exactly 125 planned messages
- exactly 25 stable sequence keys are produced
- exactly 125 unique stable message keys are produced
- message keys are suitable as provider idempotency keys
- no recipient working date receives more than 5 new prospects
- a deliberate recipient holiday moves the initial email to the next available working date
- later prospects fill capacity without breaching the five-new-prospects limit
- preferred 09:35 recipient-local send time is preserved across all five touches
- every follow-up lands exactly 3 recipient business days after the preceding touch
- weekends and supplied non-working dates are skipped
- the manifest preserves same-thread and stop-event requirements

A production scheduler also refuses a manifest created under test/import mode.

## Provider-independent lifecycle tests

The repository now models outbound sequence state independently of whichever provider is selected.

Passed:

- the same message key cannot be recorded as sent twice
- an already-sent message cannot become due again
- reply suppresses every remaining planned touch
- duplicate reply events are idempotent
- bounce suppresses every remaining touch
- opt-out suppresses every remaining touch
- manual commercial conversation suppresses every remaining touch
- provider failure is recorded and cannot be blindly retried as though nothing happened
- due-message selection respects recipient-local date and time

This gives the eventual provider adapter a second safety layer instead of relying only on vendor-side sequence settings.

## Provider readiness and preflight tests

A provider readiness contract and provider preflight now sit between the send manifest and any real outbound integration.

Passed in synthetic provider fixtures:

- valid 25-prospect/125-message provider package passes
- missing stop-on-reply capability fails
- missing same-thread/reply/bounce/opt-out/manual-pause capabilities fail
- missing idempotent send/import capability fails
- missing sender mailbox or sender identity fails
- missing physical postal address fails
- missing physical-address footer capability fails
- missing unsubscribe mechanism capability fails
- missing recent non-prospect integration test fails
- provider integration test older than 30 days fails
- missing reply-stop verification fails
- missing bounce-stop verification fails
- missing opt-out-stop verification fails
- missing physical-address verification fails
- missing unsubscribe verification fails
- missing sent-history verification fails
- manifest missing a required stop event fails
- duplicate outbound message key fails
- provider load rechecks BuiltWith pull age
- provider load rechecks current browser-site and public-email verification ages

The actual provider still must be selected, authenticated and tested with a controlled non-prospect address before a real campaign can be loaded.

## Defects found and fixed across testing

1. Imported BuiltWith files were not re-filtered locally by commercial criteria.
2. The duplicate email exclusion set existed but was not actually applied during discovery.
3. BuiltWith recency depended too heavily on the query window rather than explicit record-level freshness.
4. The discovery system did not preserve enough source/cache provenance to distinguish a fresh pull from questionable data.
5. Imported data could previously look too similar to production data.
6. There was no independent live-domain/redirect recheck after BuiltWith discovery.
7. The validator could pass without all later campaign stages being present.
8. Fresh browser and public-email verification ages were not enforced at preflight.
9. Sequence QA did not bind outreach statements to stable sourced evidence IDs.
10. Final email word counts were not independently checked against stored values.
11. Scheduling could run without proof that all upstream stages had passed.
12. Upstream files could change after validation without invalidating scheduling.
13. Holiday-shifted initial sends could exceed the five-new-prospects-per-date capacity.
14. Outbound messages did not originally have stable idempotency keys.
15. Rejected serious evaluations were not always persisted by ledger synchronisation.
16. A verified Stage 2 prospect could collide with an earlier permanent-ledger identity after discovery without forcing replacement.
17. The legacy all-in-one CLI exposed weaker bypass paths.
18. Chained npm preflight commands did not pass campaign arguments to every child process; unified wrapper entrypoints fixed this.
19. Provider stop conditions existed as requirements but lacked provider-independent runtime state tests.
20. Provider readiness did not initially prove physical-address and unsubscribe delivery behaviour.
21. Qualification and research prompts described some handoffs in prose rather than exact machine-readable contracts.

## Local regression status

The latest deterministic campaign fixture passes the full source-freshness, commercial-filter, live-domain, qualification, evidence, scheduling and ledger flow.

Separate local provider lifecycle and provider-preflight fixtures also pass their valid cases and reject their deliberate failure cases.

GitHub Actions was attempted earlier, but the repository runner failed before exposing usable job steps/logs through the connected GitHub API. That infrastructure result is not being treated as either a code pass or a code failure. The authoritative test evidence is the isolated local regression suite recorded above.

## External activation tests still required

Everything that can be tested without external credentials has been hardened. The following are intentionally blocked until the relevant credentials/accounts exist:

1. Authenticate against the real BuiltWith Lists API and verify the first production pull, including API response freshness provenance and real result quality.
2. Confirm the actual BuiltWith plan returns full usable records for the configured queries.
3. Run real browser/current-contact qualification against the first production candidate pool.
4. Select and authenticate the outbound sequence provider and exact sender mailbox.
5. Run the mandatory non-prospect provider integration test proving delivery, same-thread follow-ups, reply stop, bounce stop, opt-out stop, physical-address footer, unsubscribe mechanism, sent-history visibility and idempotent retry behaviour.
6. Run provider preflight against the first real 125-message production manifest.

No real prospect email should be sent before those external activation tests pass.
