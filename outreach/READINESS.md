# Outreach System Readiness

Serial: WEBLEADS-READINESS-20260808-001

## Status

The repository implementation is ready for external activation testing.

Everything that can be exercised without a real BuiltWith credential or authenticated outbound-provider account has been implemented and regression-tested.

No production prospect may be contacted until the two credential-gated activation tests at the end of this document pass.

## What is ready

The current branch contains a complete deterministic operating path for:

- weekly campaign initialisation
- fresh BuiltWith commercial discovery
- record-level source freshness filtering
- API cache/provenance validation
- permanent duplicate exclusion
- live-domain and redirect rechecks
- exact 25-prospect qualification
- fresh website and public-email verification requirements
- persistent qualified/rejected ledger state
- sourced prospect evidence banks
- focused mock-up evidence
- weekly cold-email theory review binding
- five grounded personalised touches per prospect
- recipient timing and non-working-date checks
- source, theory, timing, evidence and campaign preflights
- exactly 125 planned messages per 25-prospect campaign
- stable sequence/message idempotency keys
- reply, bounce, opt-out and manual-conversation suppression state
- outbound-provider capability/integration preflight
- Reply.io dry-run operation planning
- one-week and two-week batching
- post-campaign learning

## Latest local regression result

The exact current branch archive was downloaded and the full test command was run after the latest package-script correction:

```bash
npm run outreach:test
npm run verify
```

Both commands completed successfully.

The outreach regression command currently covers:

1. full commercial/source/liveness/qualification/evidence/scheduling/ledger flow
2. weekly theory freshness and recipient timing
3. permanent-ledger duplicate blocking and idempotency
4. two-week batch duplicate exclusion
5. provider-independent lifecycle suppression
6. provider-load timing safety
7. provider readiness and outbound preflight
8. Reply.io dry-run operation planning

The existing portfolio verification also passes.

## Production source rules

A real campaign cannot use a BuiltWith export or previous discovery file as its production source.

Production requires a fresh authenticated BuiltWith Lists API pull. The system then:

- records a new retrieval run ID
- sends no-cache request headers
- rejects materially stale HTTP Age/Date evidence when supplied
- records response provenance and payload hashes
- requires BuiltWith last-detected timestamps
- prefers records detected within 14 days
- rejects records older than 30 days
- runs direct live-domain checks
- requires later fresh browser and public-email verification
- rechecks source/site/contact freshness again at provider load

The source pull itself may not be older than the configured 48-hour production limit.

## Production outbound rules

The campaign cannot be loaded into a sender merely because the 125-message manifest exists.

The selected provider must first pass a controlled non-prospect integration test proving:

- correct sender mailbox
- initial delivery
- same-thread follow-ups
- stop on reply
- stop on bounce
- stop on opt-out
- manual pause
- physical postal address/footer delivery
- working unsubscribe mechanism
- sent-history visibility
- idempotent retry behaviour

Provider preflight then rechecks the current BuiltWith pull, browser verification, public-email verification and the full manifest before production loading.

## Current outbound-provider candidate

Reply.io is the current first candidate because the current v3 API provides sequence, contact, scheduling and sequence-contact primitives that map well to the campaign model.

The repository includes a dry-run Reply.io planner only. It does not authenticate or create remote sequences without a real account and explicit credential.

The planner produces one provider sequence per researched prospect so all five messages remain genuinely prospect-specific rather than being reduced to a shared mail-merge template.

## Two-week readiness

A two-week build is supported as two independent weekly campaigns rather than one 50-prospect campaign.

Week 1 qualification is written to the permanent ledger before Week 2 discovery begins. Week 2 then runs a separate fresh BuiltWith pull, preventing intentional reuse of Week 1 businesses and preserving five new prospects per working day.

## External activation tests remaining

Only credential/account-dependent work remains:

1. Supply the real BuiltWith API key through a secure environment secret and run the first authenticated Lists API production pull. Verify the returned fields, freshness provenance, record-level last-detected distribution and actual commercial quality of the candidate pool.
2. Select/authenticate the real outbound provider and exact sender mailbox, run the mandatory controlled non-prospect integration test, then run provider preflight against the first real production manifest.

Until those two tests pass, the system is deliberately unable to produce/send a live prospect campaign.

No API key or provider secret should be committed to the repository.
