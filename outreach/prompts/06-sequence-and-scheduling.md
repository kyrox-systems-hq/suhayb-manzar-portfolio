# Stage 6: Personalised Sequences and Scheduling

Serial: WEBLEADS-STAGE6-20260808-004

## Objective

Write the complete five-touch sequence for all 25 prospects, ground every material claim in the research/mock-up evidence bank, and bind the copy to the current weekly email-theory review before generating the reply-aware send manifest.

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

This creates `outreach/campaigns/<week>/07-send-manifest.json` only after source, theory, timing, evidence and campaign preflights pass.

## Bind the sequences to the current theory review

Read the `Reviewed:` date and `Review-ID:` from `05-email-standard.md` before writing any prospect email.

At the top level of `06-sequences.json`, copy them exactly as:

```json
{
  "schema_version": 3,
  "campaign_week": "YYYY-MM-DD",
  "email_standard_reviewed": "YYYY-MM-DD",
  "email_standard_review_id": "WEBLEADS-EMAIL-...",
  "sequences": []
}
```

Campaign preflight rejects a sequence file that does not match the current theory review. If the email standard changes after the sequences are written, re-read it and re-confirm or rewrite the sequences before continuing.

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
- easy implementation response

## Evidence-grounding gate

Every `evidence_used` value must be an **evidence ID**, not free-form prose.

Valid IDs come only from:

- `03-dossiers.json > evidence_bank[].id`
- `04-mockups.json > demonstrated_improvements[].id`

Do not introduce a fact, commercial signal or demonstrated improvement into the sequence unless it exists in one of those evidence records.

Across all five touches, use at least four distinct grounded evidence IDs. Do not simply relabel the same observation five times.

The preflight rejects unknown evidence IDs and follow-ups that are textually too similar to one another.

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
- always include `non_working_dates` as an array, even when empty
- if there is no evidence for a more precise time, omit `preferred_local_send_time` and let the scheduler use the configured local business-hours window

The scheduler treats each follow-up as three recipient business days after the previous touch. It skips Saturdays, Sundays and the supplied `non_working_dates`.

## Required sequence record

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
- touches, array of exactly five objects

Each touch must contain:

```json
{
  "touch_number": 1,
  "subject": "Touch 1 subject, null for threaded follow-ups",
  "body_text": "",
  "purpose": "",
  "evidence_used": ["site-1", "mockup-hierarchy"],
  "word_count": 0
}
```

The recorded `word_count` must match the final body after editing.

## Production scheduling gate

A production manifest cannot be generated from a BuiltWith export or test-mode source preflight. Production scheduling requires the fresh authenticated BuiltWith Lists API path.

Do not send automatically.

Before loading `07-send-manifest.json` into an outbound provider, confirm the exact sender mailbox, authenticated sending capability, reply detection, bounce detection, opt-out handling, same-thread behaviour, recipient timezone, stop-on-reply functionality and compliance status.

The provider must stop remaining touches after reply, bounce, opt-out or manual commercial conversation.

Ordinary scheduled-send functionality that cannot stop on reply is not sufficient.
