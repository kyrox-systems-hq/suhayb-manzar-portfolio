# Stage 6: Personalised Sequences and Scheduling

Serial: WEBLEADS-STAGE6-20260807-002

## Objective

Write the complete five-touch sequence for all 25 prospects, then generate the reply-aware send manifest.

Read:

- `outreach/campaigns/<week>/02-qualified.json`
- `outreach/campaigns/<week>/03-dossiers.json`
- `outreach/campaigns/<week>/04-mockups.json`
- `outreach/campaigns/<week>/05-email-standard.md`
- `outreach/config.json`

Write:

- `outreach/campaigns/<week>/06-sequences.json`

Then run:

```bash
npm run outreach:validate -- --week=<week>
npm run outreach:schedule -- --week=<week>
```

This creates:

- `outreach/campaigns/<week>/07-send-manifest.json`

## Sequence logic

Touch 1:
- why this business
- one real commercially relevant observation
- link to the verified live mock-up
- explain only what the concept visibly demonstrates
- clarify it is a focused concept
- direct but low-friction implementation CTA

Touch 2, three recipient business days later:
- add a second useful observation or another commercially relevant aspect of the concept
- do not merely ask whether they saw the first email

Touch 3, three recipient business days later:
- use a different commercial angle, such as mobile experience, paid traffic, trust, hierarchy or purchase friction
- do not repeat Touch 1

Touch 4, three recipient business days later:
- reduce implementation uncertainty
- make clear that the concept can be implemented into the live platform
- keep the CTA simple

Touch 5, three recipient business days later:
- final short close
- no guilt
- no passive aggression
- easy yes/no or implementation response

## Personalisation gate

Every sequence must contain details that could only have been written after researching that specific business.

Reject generic lines such as:

- "I came across your website"
- "I love what you're doing"
- "Your website looks great but..."
- "I help businesses like yours"
- "Just following up"
- "Bumping this"
- "Any thoughts?"
- "I never heard back"

Do not invent urgency, results or financial impact.

## Recipient timing research

For each prospect:

- confirm the correct IANA timezone from the verified business location
- choose the preferred local send time using the campaign email standard and what is known about the recipient's role
- record it as `preferred_local_send_time` in 24-hour `HH:MM` format
- identify relevant public holidays or other known non-working dates that intersect the sequence and record them as ISO dates in `non_working_dates`
- if there is no evidence for a more precise time, omit `preferred_local_send_time` and let the scheduler use the configured local business-hours window

The scheduler treats each follow-up as three **recipient business days** after the previous touch. It skips Saturdays, Sundays and the supplied `non_working_dates`.

## Required JSON structure

Each sequence record must contain:

- business_name
- domain
- recipient_name
- recipient_role
- recipient_email
- recipient_timezone
- preferred_local_send_time, optional
- non_working_dates, array
- country
- live_mockup_url
- compliance_status
- compliance_basis
- touches: array of exactly five objects

Each touch must contain:

- touch_number
- subject for Touch 1, null for threaded follow-ups unless the provider requires otherwise
- body_text
- purpose
- evidence_used
- word_count

## Provider scheduling gate

Do not send automatically.

Before loading `07-send-manifest.json` into an outbound provider, confirm:

- exact sender mailbox
- authenticated sending capability
- correct recipient
- reply detection
- bounce detection
- opt-out handling
- same-thread follow-up behaviour
- recipient timezone
- stop-on-reply functionality
- compliance status

The provider must stop remaining touches after:

- reply
- bounce
- opt-out
- manual commercial conversation

Ordinary scheduled-send functionality that cannot stop on reply is not sufficient.
