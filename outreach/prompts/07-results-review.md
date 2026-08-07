# Stage 7: Campaign Results Review

Serial: WEBLEADS-STAGE7-20260807-001

## Objective

After the campaign has had enough time to progress, analyse what actually generated commercial momentum and feed that learning into the next BuiltWith discovery run.

Do not optimise for opens alone. Prioritise replies, positive conversations and implementation work.

## Inputs

Use the provider's delivery/reply export plus the original campaign records.

At minimum capture for each prospect:

- business_name
- domain
- revenue estimate band used at discovery
- employee estimate band
- technology-spend estimate band
- ecommerce platform
- important marketing technologies
- primary website problem type
- conversion surface mocked up
- recipient role
- initial send date and local time
- delivered status
- bounced status
- opt-out status
- reply status
- reply touch number
- reply sentiment: positive, neutral, negative
- commercial conversation started: yes/no
- implementation won: yes/no
- realised revenue where appropriate

## Analyse

Compare response and commercial outcomes by:

- estimated revenue band
- employee band
- technology-spend band
- ecommerce platform
- evidence of paid acquisition
- website-problem type
- mock-up surface
- recipient role
- country
- initial email angle
- touch that generated the reply

Distinguish between:

- delivery problem
- targeting problem
- offer/problem mismatch
- email-copy problem
- implementation-friction problem

Do not draw strong conclusions from tiny samples. Label directional findings as tentative.

## Output

Write:

`outreach/campaigns/<week>/08-results-review.md`

End with no more than five concrete changes to test in the next campaign.

Examples:

- tighten or widen the BuiltWith revenue range
- increase minimum technology spend
- prioritise a particular platform or marketing stack
- favour a specific website-problem type
- change the recipient role
- change an email-standard rule

Never silently change `outreach/config.json`. Recommend changes first so the next campaign retains a traceable hypothesis.
