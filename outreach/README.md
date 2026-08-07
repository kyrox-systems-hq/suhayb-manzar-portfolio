# Weekly Research-Led Website Outreach System

Serial: WEBLEADS-SYSTEM-20260808-004

This directory turns website outreach into a weekly production system for 25 commercially qualified businesses, with five new prospects entering the sequence per recipient working day.

## Core principle

Start with businesses that can plausibly afford implementation, then find a website problem worth fixing.

Do not start from businesses merely asking strangers for free website feedback.

The expensive work begins only after commercial, freshness, contact and compliance gates pass.

## What is deterministic

The CLI handles:

- fresh BuiltWith Lists API discovery
- local revenue, employee, technology-spend, SKU and market filters
- BuiltWith last-detected freshness checks
- API response-cache and provenance checks
- duplicate exclusion against `public/mockups/_outreach-ledger.json`
- fresh domain liveness and redirect checks
- campaign handoff validation
- evidence-grounding checks for email copy
- SHA-256 protection against changing protected stages after preflight
- exactly five touches per prospect
- exactly three recipient business days between touches
- recipient timezone, holidays and preferred local send times
- maximum five new prospects per recipient working date
- stable sequence and message idempotency keys
- qualified and rejected prospect ledger persistence
- outbound-provider readiness checks

The research agent handles:

- commercial cross-checking
- current desktop and mobile website inspection
- exact public email verification
- compliance-basis verification
- commercial diagnosis
- sourced evidence-bank creation
- focused mock-up design and audit
- live mock-up verification
- current cold-email theory research
- writing five grounded, highly personalised touches

## Production freshness rules

A production campaign must begin with a fresh authenticated BuiltWith Lists API pull.

BuiltWith exports remain supported for testing, but they are explicitly marked non-production and cannot generate a production send manifest.

The production discovery path:

1. Requests BuiltWith data with `SINCE=30 Days Ago`.
2. Requests intermediaries not to serve cached content.
3. Rejects an API response when a supplied HTTP `Age` header exceeds the configured cache-age limit.
4. Rejects an API response when a supplied HTTP `Date` header is materially stale.
5. Records response provenance, timestamps, ETag where available and a SHA-256 of each response payload.
6. Requires a record-level BuiltWith last-detected timestamp.
7. Prefers records detected within 14 days.
8. Rejects records last detected more than 30 days ago.
9. Rejects materially future-dated BuiltWith timestamps.
10. Runs a separate fresh HTTP liveness check against every discovered domain and follows redirects.
11. Treats redirects into excluded businesses or multiple records resolving to the same storefront as duplicates.
12. Requires the final browser verification and public-email verification to be no older than 24 hours when campaign preflight runs.
13. Rechecks those ages again before loading the outbound provider.

The BuiltWith pull itself must be no older than 48 hours at production source preflight and provider loading.

BuiltWith revenue, employee and technology-spend values remain estimates and are ranking signals, not verified company financials.

## Weekly cadence

Run the production build over the weekend for the following campaign week.

1. Initialise the campaign.
2. Pull approximately 40 to 50 fresh commercially credible stores from BuiltWith.
3. Run live-domain and redirect checks.
4. Qualify and replace failures until exactly 25 pass.
5. Persist both qualified and seriously evaluated rejected candidates to the permanent ledger.
6. Research all 25 and create sourced evidence banks.
7. Build, audit, deploy and verify 25 focused mock-ups.
8. Refresh the campaign email standard from current evidence.
9. Write all five touches for every prospect using evidence IDs only.
10. Run source, evidence and campaign preflight.
11. Generate the 125-message send manifest.
12. Run outbound-provider preflight.
13. Load the campaign into the verified reply-aware provider.
14. Send five new prospects per working date.
15. Stop remaining touches on reply, bounce, opt-out or manual commercial conversation.
16. Review outcomes before changing the next BuiltWith filters.

## BuiltWith commands

Production:

```bash
BUILTWITH_API_KEY=... npm run outreach:discover -- --week=2026-08-10
npm run outreach:live-check -- --week=2026-08-10
```

Test-only import:

```bash
npm run outreach:discover -- --week=2026-08-10 --input=/path/to/builtwith.json
OUTREACH_TEST_MODE=1 npm run outreach:live-check -- --week=2026-08-10
```

An imported discovery file cannot become a production-ready send manifest.

## Campaign files

Each campaign lives under:

```text
outreach/campaigns/YYYY-MM-DD/
```

The date is the Monday campaign start date.

Expected working files:

```text
campaign.json
01-discovered.json
01-live-checked.json
source-preflight.json
02-qualified.json
03-dossiers.json
04-mockups.json
05-email-standard.md
06-sequences.json
preflight.json
07-send-manifest.json
08-provider-preflight.json
09-results-review.md
```

Operational campaign folders are gitignored because they contain prospect contact details, research dossiers and email copy.

## Commands

```bash
npm run outreach:init -- --week=2026-08-10
npm run outreach:discover -- --week=2026-08-10
npm run outreach:live-check -- --week=2026-08-10
npm run outreach:status -- --week=2026-08-10
npm run outreach:ledger-sync -- --week=2026-08-10
npm run outreach:validate -- --week=2026-08-10
npm run outreach:schedule -- --week=2026-08-10
npm run outreach:provider-preflight -- --week=2026-08-10 --config=/secure/path/provider-readiness.json
npm run outreach:test
```

The package scripts are the authoritative entrypoints. The generic `scripts/outreach.mjs` intentionally exposes only campaign initialisation and status, so weaker legacy discovery, validation or scheduling routes cannot bypass the hardened gates.

## Evidence-grounded outreach

Stage 3 creates a sourced `evidence_bank` for every prospect.

Stage 4 adds verified `mockup-*` evidence IDs for improvements that are visibly demonstrated in the deployed concept.

Stage 6 may use only those evidence IDs. The preflight rejects:

- unknown evidence IDs
- unsourced dossier evidence
- sequences using fewer than four distinct grounded evidence items
- mismatched final word counts
- generic low-value follow-up language
- highly repetitive touches
- unsupported mock-up claims

The email should feel like one person researched one business and built something specifically for it, not like a mail merge.

## Scheduling and idempotency

A valid campaign produces exactly 25 sequences and 125 messages.

Each message has:

- a stable `sequence_key`
- a stable `message_key`
- recipient-local schedule
- same-thread instruction
- required stop events

The stable keys allow a provider adapter to prevent duplicate sends if loading or dispatch is retried.

The provider-independent sequence-state module also models suppression after reply, bounce, opt-out or manual conversation.

## Outbound provider gate

No provider is hard-wired into the research system.

Before loading a real campaign, copy `outreach/provider-readiness.example.json` to a secure operational location and complete it with the selected provider and sender details.

The provider preflight requires:

- authenticated sending credential
- exact sender mailbox and display name
- physical postal address
- unsubscribe method
- per-prospect custom content
- recipient-timezone scheduling
- same-thread follow-ups
- reply detection and stop-on-reply
- bounce detection and stop
- opt-out detection and stop
- manual pause
- idempotent import or send behaviour
- delivery-status export
- a recent non-prospect integration test proving initial send, threading, reply stop, bounce stop, opt-out stop and sent-history visibility

See `outreach/PROVIDER_CONTRACT.md`.

## Testing

`npm run outreach:test` runs three independent regression suites:

1. Campaign discovery, source freshness, liveness, qualification, evidence grounding, scheduling and ledger persistence.
2. Provider-independent lifecycle suppression and idempotency.
3. Outbound provider-preflight validation.

`outreach/TEST_REPORT.md` records the failure-oriented test history and the defects found during hardening.

Synthetic tests do not substitute for the two final activation tests:

- authenticated live BuiltWith Lists API retrieval
- an authenticated non-prospect outbound-provider integration test

## Stage prompts

Start with:

`outreach/prompts/00-weekly-orchestrator.md`

Then run Stages 1 to 6 in order. Stage 7 is the post-campaign learning loop.

Never combine stages simply to save time.
