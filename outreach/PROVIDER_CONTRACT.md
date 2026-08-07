# Outbound Provider Contract

Serial: WEBLEADS-PROVIDER-20260807-001

The research and build workflow is independent of the sending platform.

A provider may load `07-send-manifest.json` only when all requirements below are satisfied.

## Required capabilities

The provider must support:

- authenticated sender mailbox
- scheduled delivery by recipient timezone
- five-touch sequences
- three-business-day spacing
- same-thread follow-ups or an explicitly approved equivalent
- reply detection
- automatic stop on reply
- bounce detection and stop
- unsubscribe or opt-out handling
- manual pause when a commercial conversation begins
- per-prospect custom email body
- per-prospect custom live mock-up URL
- exportable delivery and reply status

## Required preflight

Before loading a campaign:

1. Confirm the exact sending mailbox.
2. Confirm the mailbox is authorised for outbound cold email.
3. Confirm the sender identity and physical postal address required for the target jurisdiction.
4. Confirm the unsubscribe method.
5. Confirm reply detection is connected to the same mailbox.
6. Confirm stop-on-reply is enabled.
7. Confirm bounce and opt-out suppression.
8. Confirm the campaign timezone behaviour.
9. Confirm the 25 recipients and 125 messages match the approved manifest.
10. Test with a non-prospect internal address before activating the campaign.

## Provider adapter

No provider is hard-wired into the repository.

This is intentional. A normal email client's scheduled-send feature is not enough if it cannot cancel future touches when a reply arrives.

When a provider is selected, add a narrow adapter that converts `07-send-manifest.json` into that provider's API/import format. Do not modify the research, qualification or mock-up stages to suit the sending tool.
