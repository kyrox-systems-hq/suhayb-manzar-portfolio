# Outbound Provider Contract

Serial: WEBLEADS-PROVIDER-20260808-003

The research and build workflow is intentionally independent of the final sending platform.

A provider may load `07-send-manifest.json` only after `08-provider-preflight.json` has been generated successfully for the current campaign.

## Required provider capabilities

The provider must support:

- authenticated sender mailbox
- per-prospect custom content
- recipient-timezone scheduling
- five-touch sequences
- same-thread follow-ups
- reply detection
- automatic stop on reply
- bounce detection and stop
- opt-out detection and stop
- manual sequence pause when a commercial conversation begins
- idempotent import or send behaviour
- delivery and reply status export
- physical postal address/footer delivery
- a working unsubscribe mechanism

Ordinary email-client scheduled send is not sufficient when it cannot cancel future touches after a reply or other stop event.

## Manifest safety requirements

Every outbound message carries:

- `sequence_key`
- `message_key`
- recipient
- touch number
- recipient-local send date and time
- same-thread instruction
- stop events
- compliance basis
- live mock-up URL

`message_key` is the idempotency key. A provider adapter must never create or send the same `message_key` twice, even when a load or API request is retried.

The repository's provider-independent sequence-state module provides a second safety model for:

- already-sent suppression
- reply suppression
- bounce suppression
- opt-out suppression
- manual-conversation suppression
- provider-failure state

## Provider readiness file

Start from:

`outreach/provider-readiness.example.json`

Keep the completed operational copy outside the public repository when it contains sensitive configuration.

It must identify:

- provider name
- sender mailbox
- sender display name
- physical postal address
- unsubscribe method
- credential environment variable name
- all required capability confirmations
- non-prospect integration-test recipient
- integration-test date
- integration-test results

Never put the actual API secret in this file.

## Mandatory non-prospect integration test

Before a provider may carry real outreach, test it using an address controlled for testing rather than a prospect.

Verify all of the following:

1. Initial message is delivered from the intended sender mailbox.
2. Follow-up remains in the intended thread.
3. A reply is detected and all remaining touches stop.
4. A bounce is detected and all remaining touches stop.
5. An opt-out is detected and all remaining touches stop.
6. The required physical postal address/footer appears correctly in the delivered message.
7. The unsubscribe mechanism appears, works and suppresses remaining touches.
8. The sent message is visible in provider or mailbox history.
9. Retrying the same message/import does not create a duplicate send.

The provider-readiness integration test is considered stale after 30 days and must then be repeated.

## Production provider preflight

Run:

```bash
npm run outreach:provider-preflight -- --week=YYYY-MM-DD --config=/secure/path/provider-readiness.json
```

The preflight refuses production loading unless:

- the campaign was built from a fresh authenticated BuiltWith Lists API pull
- source and campaign preflights are still passed
- there are exactly 25 prospects and 125 messages
- all message and sequence keys are valid and unique
- every sequence has touches 1 through 5
- every message carries all required stop events
- the live-site and public-email checks are still within their freshness window
- the sender identity is complete
- the provider credential is present in the named environment variable
- every required provider capability is verified
- physical-address and unsubscribe delivery behaviour have been verified
- the recent non-prospect integration test passed

A successful run writes:

`outreach/campaigns/<week>/08-provider-preflight.json`

No production adapter should load or send the campaign before that file exists for the current manifest.

## Provider adapter boundary

When a provider is selected, add a narrow adapter that:

1. Reads the verified manifest and provider preflight.
2. Maps recipient, content, schedule, threading and stop-event behaviour into the provider's API or import format.
3. Uses `message_key` as the idempotency key wherever the provider permits one, and otherwise maintains a local sent-key registry.
4. Records provider sequence IDs and message IDs.
5. Reconciles replies, bounces, opt-outs and manual pauses into the provider-independent sequence state.
6. Preserves the required physical address/footer and unsubscribe mechanism.
7. Exports delivery and reply outcomes for Stage 7 analysis.

Do not modify commercial discovery, qualification, research or mock-up logic to suit the sending platform.
