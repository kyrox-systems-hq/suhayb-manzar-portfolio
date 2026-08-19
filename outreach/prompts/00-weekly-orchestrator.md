# Weekly Outreach Orchestrator

Serial: WEBLEADS-ORCHESTRATOR-20260808-002

## Objective

Run one complete weekly research-led website outreach campaign without collapsing discovery, research, design and email writing into one giant prompt.

Target output:

- a fresh authenticated BuiltWith discovery pull
- at least 25 current live qualification candidates
- exactly 25 fully qualified businesses
- 25 freshly verified public contacts
- 25 sourced commercial research dossiers
- 25 focused, verified live mock-ups
- one current campaign email standard
- 25 five-touch evidence-grounded personalised sequences
- one validated 125-message send manifest
- one passed outbound-provider preflight before provider loading

Do not send emails automatically from this orchestration prompt.

## Campaign start

Use the Monday of the intended sending week as `<week>`.

Run:

```bash
npm run outreach:init -- --week=<week>
```

Then execute Stages 1 to 6 in order.

## Stage discipline

Each stage has one job. Do not start the next stage until the previous stage output exists and passes its gate.

### Stage 1: Fresh commercial discovery

Use `outreach/prompts/01-discovery.md`.

Production requires an authenticated live BuiltWith Lists API pull. Test imports cannot become production manifests.

Run:

```bash
BUILTWITH_API_KEY=... npm run outreach:discover -- --week=<week>
npm run outreach:live-check -- --week=<week>
```

Goal: approximately 40 to 50 fresh commercially filtered records, with at least 25 surviving current live-domain and redirect checks.

Never reuse an old discovery file as if it were a fresh pull.

### Stage 2: Qualification and contact gate

Use `outreach/prompts/02-qualification.md`.

Goal: exactly 25 prospects after freshness, commercial, website, exact-public-email and compliance gates.

The current website/browser check and public email source check must be freshly timestamped.

Update the permanent outreach ledger for every seriously evaluated candidate.

Run:

```bash
npm run outreach:ledger-sync -- --week=<week>
```

### Stage 3: Research and evidence bank

Use `outreach/prompts/03-research.md`.

Goal: one sourced commercial diagnosis, one intervention brief and at least three evidence-bank items per prospect.

### Stage 4: Focused mock-up

Use `outreach/prompts/04-mockup.md`.

Goal: one tested and deployed conversion concept per prospect, plus at least two `mockup-*` evidence items describing improvements that are visibly demonstrated.

No email work may begin while any selected mock-up route is unverified.

### Stage 5: Current cold-email theory

Use `outreach/prompts/05-outreach-theory.md`.

Goal: refresh the campaign's cold-email standard using current credible evidence before any prospect sequence is written.

### Stage 6: Personalised sequence and schedule

Use `outreach/prompts/06-sequence-and-scheduling.md`.

Goal: write all five touches for all 25 businesses using only valid research/mock-up evidence IDs.

Run:

```bash
npm run outreach:validate -- --week=<week>
npm run outreach:schedule -- --week=<week>
```

The source, evidence and campaign preflights must all pass. Scheduling must produce exactly 25 sequence keys and 125 unique message keys.

## Outbound-provider activation gate

Complete a secure operational copy of:

`outreach/provider-readiness.example.json`

The provider must first pass a non-prospect integration test proving initial delivery, same-thread follow-up behaviour, reply stop, bounce stop, opt-out stop, sent-history visibility and idempotent loading/sending.

Then run:

```bash
npm run outreach:provider-preflight -- --week=<week> --config=/secure/path/provider-readiness.json
```

Do not load the real campaign until `08-provider-preflight.json` passes.

## Stop conditions

Stop rather than lowering standards if:

- the authenticated BuiltWith Lists API pull is unavailable for production
- BuiltWith source provenance or freshness fails
- fewer than 25 prospects survive current live-domain checks
- fewer than 25 can pass the commercial, website, exact-email and compliance gates
- current browser or public-email verification becomes stale before preflight/provider loading
- a selected mock-up cannot be verified live
- a sequence contains unsupported or ungrounded claims
- the cold-email theory review cannot be completed from current credible sources
- the outbound provider cannot prove reply, bounce and opt-out suppression
- the exact sender mailbox and physical sender identity have not been confirmed

Do not lower the qualification standard merely to reach 25.

## Public versus operational data

Public repository data:

- `public/mockups/<client-slug>/`
- `public/mockups/_outreach-ledger.json`

Private operational working data:

- `outreach/campaigns/<week>/`
- completed provider-readiness configuration
- credentials

Campaign working data is gitignored because it contains prospect contact details, research dossiers and email copy. Never commit secrets.

## Final campaign handoff

Before activation, confirm:

- current BuiltWith retrieval run ID and production eligibility
- discovered and live-checked candidate counts
- qualified prospect count
- fresh verified email count
- deployed mock-up count
- grounded sequence count
- unique planned message count
- provider preflight status
- sender mailbox status
- stop-on-reply, bounce and opt-out integration-test status
- compliance exceptions or quarantined prospects

Only a fully verified production manifest should be loaded for sending.
