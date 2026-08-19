# Reply.io Provider Candidate

Serial: WEBLEADS-REPLY-20260808-001

Reply.io is the current first-choice outbound-provider candidate for this workflow because its current v3 API exposes the primitives the campaign needs to test before activation:

- sequence creation with multiple automatic email steps
- per-step `delayInMinutes`
- sequence-level `repliesHandlingType: MarkAsFinished`
- contact creation with an IANA `timeZone`
- bulk sequence enrolment with an exact `startFrom` timestamp
- sequence-contact state including `status`, `currentStep`, `nextSendAfter` and `isOptedOut`
- schedules and holiday-calendar APIs

The relevant Reply v3 endpoints are documented as beta in several places. This adapter therefore remains a candidate plan until an authenticated controlled-address integration test confirms the exact behaviour in the user's account.

## Why one sequence per prospect

Every prospect has five genuinely personalised messages. Creating one Reply sequence per prospect avoids turning the research into a variable-heavy shared template and makes each sequence independently pausable, auditable and reconcilable.

For 25 prospects, the production plan is therefore:

- 25 Reply sequences
- 25 Reply contacts
- one contact enrolled in each sequence
- five automatic email steps per sequence
- one selected sender email account

This is operationally heavier than a single mail-merge campaign, but it preserves the core proposition that every sequence is written for one researched business.

## Exact-time strategy to validate

The repository already calculates every intended recipient-local touch date and time, including weekends and recorded non-working dates.

The Reply plan converts those intended local timestamps to UTC and computes the real elapsed minutes between consecutive touches. Those elapsed minutes become the candidate `delayInMinutes` values.

The first touch uses Reply's sequence-contact `startFrom` field.

A dedicated Reply schedule should be configured so it does not unexpectedly shift the already calculated timestamps. The controlled integration test must prove that Reply's actual `nextSendAfter` values match the manifest before a real prospect is enrolled.

Do not assume delay semantics from documentation alone.

## Reply settings

The candidate sequence payload uses:

- `repliesHandlingType: MarkAsFinished`
- automatic Email steps
- one sender email account
- conservative per-sequence limits because each sequence contains only one prospect

Reply's own reply handling is not the only safety layer. The provider-independent runtime state in `scripts/outreach-sequence-state.mjs` remains the canonical local suppression model for reply, bounce, opt-out and manual-conversation events.

## Required account configuration

Before an authenticated Reply test, create a secure config based on:

`outreach/providers/reply-io/reply-config.example.json`

It requires:

- Reply API credential environment variable name
- Reply email account ID
- Reply schedule ID
- Reply team/account identifiers where needed
- exact sender mailbox

Never commit the API key itself.

## Dry-run planning

After a verified 125-message manifest exists, run:

```bash
npm run outreach:reply-plan -- --week=YYYY-MM-DD --config=/secure/path/reply-config.json
```

The command does not call Reply. It writes a provider-operation plan containing:

- the 25 sequence payloads
- the 25 contact payloads
- the 25 enrolment instructions
- expected UTC start timestamps
- expected inter-touch delay minutes
- expected recipient-local timestamps
- message and sequence idempotency keys

The dry plan is designed to make the authenticated adapter testable before it can create anything remotely.

## Mandatory authenticated integration test

Before a prospect campaign may be loaded, use a controlled non-prospect address and prove:

1. Contact creation works with the expected timezone.
2. Sequence creation accepts the generated payload shape.
3. `startFrom` produces the intended first-send time.
4. Reply's `nextSendAfter` matches the intended schedule.
5. A follow-up remains in the same email thread.
6. A reply moves/stops the contact as expected and no later touch is sent.
7. An opt-out is visible through Reply state and no later touch is sent.
8. Bounce handling prevents later touches.
9. The required postal-address/footer and unsubscribe method appear in the delivered message.
10. Re-running the adapter with the same message/sequence keys does not create a duplicate send.
11. Sent history can be reconciled back into the local campaign state.

Only after that test should Reply be marked as the selected provider in the completed provider-readiness file.

## Official API references used for this candidate

- Create sequence: `POST /v3/sequences`
- Create contact: `POST /v3/contacts`
- Bulk add contacts to sequence: `POST /v3/sequences/{id}/contact-links/bulk`
- Get contact in a sequence: `GET /v3/sequences/{id}/contacts/{contact_id}`
- Create schedules and holiday calendars through the Reply v3 schedule APIs

The API documentation may change because several endpoints are beta. Re-check the official Reply documentation immediately before writing or enabling the authenticated adapter.
