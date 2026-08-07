# Weekly Research-Led Website Outreach System

Serial: WEBLEADS-SYSTEM-20260807-002

This directory turns the portfolio outreach process into a weekly production system for 25 qualified businesses.

## Operating model

The system deliberately separates deterministic operations from judgement-heavy work.

The CLI handles:

- BuiltWith list ingestion and API discovery
- duplicate exclusion against `public/mockups/_outreach-ledger.json`
- campaign folders and stage files
- preliminary commercial scoring
- stage validation
- five-touch sequence timing
- three-recipient-business-day follow-up spacing
- recipient timezone and known non-working dates
- sequence QA rules
- ledger synchronisation after qualification

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

1. Discover 40 to 50 commercially credible stores.
2. Qualify and replace failures until exactly 25 pass.
3. Research all 25 and define one intervention each.
4. Build, audit and deploy 25 focused mock-ups.
5. Refresh the campaign email standard from current evidence.
6. Write all five touches for all 25 prospects.
7. Generate the send manifest.
8. Load the manifest into a reply-aware outbound sequencer.
9. Send five new prospects per working day.
10. Review replies and commercial outcomes before changing the next campaign filters.

The system does **not** automatically send emails. Sending is intentionally separated because the outbound provider must be authenticated, capable of stopping on reply, and configured with the correct mailbox, unsubscribe handling and jurisdictional requirements.

## BuiltWith

The discovery script supports the BuiltWith Lists API when `BUILTWITH_API_KEY` is present.

Example:

```bash
BUILTWITH_API_KEY=... npm run outreach:discover -- --week=2026-08-10
```

It can also ingest a BuiltWith JSON export:

```bash
npm run outreach:discover -- --week=2026-08-10 --input=/path/to/builtwith.json
```

BuiltWith revenue is treated as an estimate and ranking signal, never as verified turnover.

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
07-send-manifest.json
08-results-review.md
```

Operational campaign files should not be placed under `public/` and are gitignored because they contain prospect contact details, research dossiers and email copy.

## Commands

```bash
npm run outreach:init -- --week=2026-08-10
npm run outreach:discover -- --week=2026-08-10
npm run outreach:status -- --week=2026-08-10
npm run outreach:validate -- --week=2026-08-10
npm run outreach:schedule -- --week=2026-08-10
npm run outreach:ledger-sync -- --week=2026-08-10
```

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

## Cold-email baseline

The campaign-level theory review should be refreshed before the emails are written. The starting evidence base is:

- concise, highly relevant initial emails
- current account research in the opening
- focus on the buyer's problem or priority rather than pitching the service
- an offer of value rather than immediately asking for calendar time
- no unsupported ROI claims
- no guilt-based follow-ups
- follow-ups that add a new commercial angle rather than saying only "following up"

The weekly theory review may refine these rules when newer credible evidence supports a change.
