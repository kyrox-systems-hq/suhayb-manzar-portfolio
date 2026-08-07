# Weekly Outreach Orchestrator

Serial: WEBLEADS-ORCHESTRATOR-20260807-001

## Objective

Run one complete weekly research-led website outreach campaign without collapsing the stages into a single giant prompt.

Target output:

- 25 fully qualified businesses
- 25 verified contacts
- 25 commercial research dossiers
- 25 focused, verified live mock-ups
- one current campaign email standard
- 25 five-touch personalised sequences
- one validated 125-message send manifest

Do not send emails automatically.

## Campaign start

Use the Monday of the intended sending week as `<week>`.

Run:

```bash
npm run outreach:init -- --week=<week>
```

Then execute Stages 1 to 6 in order.

## Stage discipline

Each stage has one job.

Do not start the next stage until the previous stage's output exists and passes its gate.

### Stage 1

Use `outreach/prompts/01-discovery.md`.

Goal: approximately 40 to 50 commercially filtered BuiltWith prospects.

### Stage 2

Use `outreach/prompts/02-qualification.md`.

Goal: exactly 25 prospects after commercial, website, contact and compliance gates.

Update the permanent outreach ledger for every seriously evaluated candidate.

Run:

```bash
npm run outreach:ledger-sync -- --week=<week>
```

### Stage 3

Use `outreach/prompts/03-research.md`.

Goal: one evidence-backed commercial diagnosis and one intervention brief per prospect.

### Stage 4

Use `outreach/prompts/04-mockup.md`.

Goal: one tested and deployed conversion concept per prospect.

No email work may begin while any mock-up route is unverified.

### Stage 5

Use `outreach/prompts/05-outreach-theory.md`.

Goal: refresh the campaign's cold-email standard using current evidence before any prospect sequence is written.

### Stage 6

Use `outreach/prompts/06-sequence-and-scheduling.md`.

Goal: write all five touches for all 25 businesses and generate the final scheduling manifest.

Run:

```bash
npm run outreach:validate -- --week=<week>
npm run outreach:schedule -- --week=<week>
```

## Stop conditions

Stop the campaign build and report the blocker if:

- BuiltWith data or export is unavailable
- fewer than 25 prospects can pass the commercial, website, verified-email and compliance gates
- a selected mock-up cannot be verified live
- the cold-email theory review cannot be completed from current credible sources
- the outbound provider cannot stop future touches on reply, bounce, opt-out or manual conversation
- the exact sender mailbox has not been confirmed before provider loading

Do not lower the qualification standard merely to reach 25.

## Public versus operational data

Public repository data:

- `public/mockups/<client-slug>/`
- `public/mockups/_outreach-ledger.json`

Private operational working data:

- `outreach/campaigns/<week>/`

Campaign working data is gitignored because it contains prospect contact details, research dossiers and email copy. Do not commit it to the public repository.

## Final campaign handoff

Before any outbound provider is activated, report:

- qualified prospect count
- deployed mock-up count
- sequence count
- planned message count
- sender mailbox status
- outbound provider status
- stop-on-reply verification status
- compliance exceptions or quarantined prospects

Only a fully verified manifest should be loaded for sending.
