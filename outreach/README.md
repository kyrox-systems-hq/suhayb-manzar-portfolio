# Weekly Research-Led Website Outreach System

Serial: WEBLEADS-SYSTEM-20260808-005

This directory turns website outreach into a weekly production system for 25 commercially qualified businesses, with five new prospects entering the sequence per recipient working day.

## Core principle

Start with businesses that can plausibly afford implementation, then find a website problem worth fixing.

The user is not part of the research plumbing. The system must obtain its own prospect data, verify it, build the work and prepare the campaign.

## Production discovery without user handling

BuiltWith Lists API access is optional.

The default no-user route is to research current public BuiltWith website and technology-combination pages directly. Those pages expose useful commercial ranking fields such as estimated sales revenue, technology spend, product count, employee estimate where shown, followers and traffic rank.

The agent gathers multiple current BuiltWith pages itself, writes the private operational source file and runs:

```bash
npm run outreach:public-builtwith -- --week=2026-08-10 --input=/private/path/current-builtwith-pages.json
npm run outreach:live-check -- --week=2026-08-10
```

Normal operation must never ask the user to open BuiltWith, download a report, copy rows or paste an export.

When Lists API entitlement is already available, this alternative remains supported:

```bash
BUILTWITH_API_KEY=... npm run outreach:discover -- --week=2026-08-10
npm run outreach:live-check -- --week=2026-08-10
```

A manually supplied export exists only as a testing route and is not a production dependency.

## Commercial discovery rules

Target:

- US, UK and Canada
- estimated ecommerce sales around USD 30,000 to USD 300,000 per month
- estimated technology spend at least USD 100 per month
- meaningful product catalogue
- preferably 2 to 50 employees
- evidence of active commercial technology such as Klaviyo, paid-media tooling, analytics, CRO, review, support or subscription systems

Missing employee count on a public BuiltWith row is allowed at Stage 1 but must be independently resolved before qualification.

BuiltWith financial and employee values are estimates, not verified company results.

## Freshness model

Freshness is layered rather than trusting a single database field.

For the public BuiltWith route:

1. At least four distinct BuiltWith public current-list pages are fetched during the campaign build.
2. Source-page fetch evidence must be no older than 24 hours.
3. Exact page provenance is retained for every candidate.
4. Local commercial and permanent-duplicate filters are applied.
5. Every selected domain receives a separate no-cache live-domain and redirect check.
6. Stage 2 performs current desktop/mobile browser inspection.
7. Stage 2 independently verifies the exact public email and its source.
8. Browser and contact verification must still be fresh at campaign preflight and provider load.

For the Lists API route, the system additionally records retrieval provenance, response-cache evidence, payload hashes and record-level last-detected timestamps, preferring 14 days or less and rejecting more than 30 days.

No previous campaign discovery file may be reused as a new production run.

## Weekly pipeline

1. Initialise the campaign.
2. Gather approximately 40 to 50 current commercially credible stores from BuiltWith without user intervention.
3. Run live-domain and redirect checks.
4. Qualify and replace failures until exactly 25 pass.
5. Persist qualified and seriously evaluated rejected candidates to the permanent ledger.
6. Research all 25 and create sourced evidence banks.
7. Build, audit, deploy and verify 25 focused mock-ups.
8. Refresh the campaign cold-email standard from current evidence.
9. Write five grounded personalised touches per prospect.
10. Run source, theory, evidence and campaign preflight.
11. Generate exactly 125 planned messages.
12. Run outbound-provider preflight.
13. Load into a verified reply-aware sender.
14. Send five new prospects per working date.
15. Stop future touches on reply, bounce, opt-out or manual commercial conversation.
16. Review actual commercial outcomes before changing the next campaign filters.

## Deterministic safeguards

The CLI enforces:

- permanent duplicate exclusion
- current source provenance
- commercial thresholds
- live-domain/redirect checking
- exact 25-prospect stage matching
- fresh site and contact evidence
- grounded research/mock-up evidence IDs
- current cold-email theory Review-ID binding
- final word-count validation
- generic/repetitive follow-up rejection
- SHA-256 protection against stage changes after preflight
- five touches per prospect
- exactly three recipient business days between touches
- recipient timezone and known non-working dates
- maximum five new prospects per working date
- stable sequence/message idempotency keys
- provider-independent reply/bounce/opt-out/manual suppression
- provider capability and integration preflight

## Campaign files

Operational files live under:

```text
outreach/campaigns/YYYY-MM-DD/
```

They are gitignored because they contain contact information, research dossiers and email copy.

Expected files include:

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

Public mock-ups and the permanent exclusion ledger remain under `public/mockups/`.

## Commands

```bash
npm run outreach:init -- --week=2026-08-10
npm run outreach:public-builtwith -- --week=2026-08-10 --input=/private/path/current-builtwith-pages.json
npm run outreach:live-check -- --week=2026-08-10
npm run outreach:status -- --week=2026-08-10
npm run outreach:ledger-sync -- --week=2026-08-10
npm run outreach:validate -- --week=2026-08-10
npm run outreach:schedule -- --week=2026-08-10
npm run outreach:provider-preflight -- --week=2026-08-10 --config=/secure/path/provider-readiness.json
npm run outreach:test
```

The dedicated package scripts are authoritative. The generic `scripts/outreach.mjs` intentionally exposes only initialisation and status.

## Outbound provider gate

No real campaign is loaded merely because a manifest exists.

The provider must prove, using a controlled non-prospect address:

- intended sender mailbox
- same-thread follow-ups
- reply detection and stop
- bounce detection and stop
- opt-out detection and stop
- manual pause
- required physical-address/footer delivery
- working unsubscribe behaviour
- sent-history visibility
- idempotent retry behaviour

See `outreach/PROVIDER_CONTRACT.md`.

## Testing

`npm run outreach:test` exercises the current no-user BuiltWith route as well as the API/import core, source freshness, liveness, qualification, theory freshness, evidence grounding, permanent duplicates, two-week batching, scheduling, provider lifecycle, provider timing, provider preflight and reply planning.

`outreach/TEST_REPORT.md` records the failure-oriented hardening history.

The remaining activation work is external behaviour, not user data collection: live current public BuiltWith discovery is performed by the agent, and the eventual authenticated sender must pass its controlled integration test before any prospect is contacted.

## Stage prompts

Start with `outreach/prompts/00-weekly-orchestrator.md`, then run Stages 1 to 6 in order. Stage 7 is the results-learning loop.

Never combine stages merely to save time.
