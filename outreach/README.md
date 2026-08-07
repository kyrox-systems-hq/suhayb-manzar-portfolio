# Weekly Research-Led Website Outreach System

Serial: WEBLEADS-SYSTEM-20260807-003

This directory turns the portfolio outreach process into a weekly production system for 25 qualified businesses.

## Operating model

The system separates deterministic operations from judgement-heavy work.

The CLI handles:

- BuiltWith list ingestion and API discovery
- local commercial filtering of API results and imports
- duplicate exclusion against `public/mockups/_outreach-ledger.json`
- campaign folders and stage files
- preliminary commercial scoring
- strict full-campaign preflight
- SHA-256 protection against changing campaign stages after preflight
- five-touch sequence timing
- three-recipient-business-day follow-up spacing
- recipient timezone and known non-working dates
- maximum five new prospects per recipient working date
- sequence QA rules
- qualified and rejected prospect ledger synchronisation

The research agent handles:

- commercial verification
- public email verification
- compliance-basis verification
- website and mobile diagnosis
- choosing the conversion surface
- building and auditing the mock-up
- current cold-email theory research
- writing the five personalised emails

## Weekly cadence

Run the campaign at the weekend for the following Monday.

1. Discover approximately 40 to 50 commercially credible stores.
2. Qualify and replace failures until exactly 25 pass.
3. Persist both qualified and seriously evaluated rejected candidates to the permanent ledger.
4. Research all 25 and define one intervention each.
5. Build, audit and deploy 25 focused mock-ups.
6. Refresh the campaign email standard from current evidence.
7. Write all five touches for all 25 prospects.
8. Run strict campaign preflight.
9. Generate the 125-message send manifest.
10. Load the manifest into a reply-aware outbound sequencer.
11. Send five new prospects per working date.
12. Review replies and commercial outcomes before changing the next campaign filters.

The system does **not** automatically send emails. Sending remains separate because the provider must be authenticated, capable of stopping on reply, and configured with the correct mailbox, unsubscribe handling and jurisdictional requirements.

## BuiltWith

The discovery script supports the BuiltWith Lists API when `BUILTWITH_API_KEY` is present.

```bash
BUILTWITH_API_KEY=... npm run outreach:discover -- --week=2026-08-10
```

It can also ingest a BuiltWith JSON export:

```bash
npm run outreach:discover -- --week=2026-08-10 --input=/path/to/builtwith.json
```

Both paths receive the configured local commercial filters and permanent duplicate exclusions. BuiltWith revenue is treated as an estimate and ranking signal, never as verified turnover.

## Campaign folders

Each campaign lives under:

```text
outreach/campaigns/YYYY-MM-DD/
```

The date must be the Monday on which the campaign starts.

Expected files:

```text
campaign.json
01-discovered.json
02-qualified.json
03-dossiers.json
04-mockups.json
05-email-standard.md
06-sequences.json
preflight.json
07-send-manifest.json
08-results-review.md
```

`preflight.json` is generated only when the full campaign passes validation. It stores hashes of the protected campaign stages. Scheduling refuses to run if any protected file changes afterwards.

Operational campaign files should not be placed under `public/` and are gitignored because they contain prospect contact details, research dossiers and email copy.

## Commands

```bash
npm run outreach:init -- --week=2026-08-10
npm run outreach:discover -- --week=2026-08-10
npm run outreach:status -- --week=2026-08-10
npm run outreach:ledger-sync -- --week=2026-08-10
npm run outreach:validate -- --week=2026-08-10
npm run outreach:schedule -- --week=2026-08-10
npm run outreach:test
```

The package scripts are the authoritative entrypoints. The generic `scripts/outreach.mjs` intentionally exposes only campaign initialisation and status, so weaker legacy discovery, validation or scheduling paths cannot bypass the hardened gates.

## Stage prompts

Start with:

`outreach/prompts/00-weekly-orchestrator.md`

Then run Stages 1 to 6 in order. Stage 7 is the post-campaign learning loop.

Each stage must read the previous stage output and write its own handoff file. Do not combine stages merely to save time.

The hard rule is:

**Commercial qualification first. Expensive research and mock-up work only after a prospect passes the contact and compliance gates.**

## Reply-aware delivery requirement

The final sequencer must stop remaining touches when any of these occurs:

- reply
- bounce
- opt-out
- manual commercial conversation

Do not use ordinary scheduled-send functionality if it cannot reliably enforce those stop conditions.

See `outreach/PROVIDER_CONTRACT.md` before connecting a sender.

## Testing

`outreach/TEST_REPORT.md` records the failure-oriented synthetic campaign test performed on 7 August 2026. It deliberately exercised duplicates, commercial-filter failures, incomplete stages, bad follow-ups, stale preflight data, holidays, local send times, three-business-day spacing and ledger persistence.

That synthetic test does not substitute for live activation tests using an authenticated BuiltWith key and the selected reply-aware outbound provider.

## Cold-email baseline

The campaign-level theory review must be refreshed before the emails are written. The starting evidence base is:

- concise, highly relevant initial emails
- current account research in the opening
- focus on the buyer's problem or priority rather than pitching the service
- an offer of value rather than immediately asking for calendar time
- no unsupported ROI claims
- no guilt-based follow-ups
- follow-ups that add a new commercial angle rather than saying only "following up"

The weekly theory review may refine these rules when newer credible evidence supports a change.
