# Outreach System Test Report

Serial: WEBLEADS-TEST-20260807-001

Tested: 7 August 2026

## Verdict

The first implementation did not behave exactly as intended. The failure-oriented test uncovered several gate and scheduling weaknesses. Those weaknesses were hardened on the branch and the deterministic campaign core was then re-run successfully in an isolated local fixture.

This report does not claim that live BuiltWith access or live outbound sending has been tested.

## Synthetic campaign used

- campaign size: 25 qualified prospects
- discovery fixture: valid stores plus deliberate duplicates and out-of-range stores
- touches per prospect: 5
- expected planned messages: 125
- initial-send capacity: 5 prospects per recipient working date
- follow-up gap: exactly 3 recipient business days
- one deliberate recipient holiday
- one deliberate preferred local send time of 09:35
- no real businesses contacted
- no real email sent

## Discovery tests

Passed after hardening:

- existing ledger domain excluded
- existing ledger business name excluded
- existing ledger contact email excluded
- within-run duplicate excluded
- revenue below configured range excluded
- employee count below configured range excluded
- technology spend below configured minimum excluded
- SKU count below configured minimum excluded
- country outside configured campaign markets excluded
- valid imported BuiltWith records still accepted
- imported BuiltWith data now receives the same local commercial filtering as API data

The test fixture contained 10 valid new records and multiple deliberate failures. Discovery returned exactly the 10 valid new records.

## Qualification and preflight tests

Passed after hardening:

- a superficially complete 25-record qualification file cannot pass without downstream dossiers, mock-ups, email standard and sequences
- exact email source is required
- location and valid IANA timezone are required
- commercial verification notes are required
- primary website problem and conversion surface are required
- compliance status, basis and evidence URLs are required
- component scores are required
- duplicate qualified contact emails are rejected
- non-configured countries are rejected
- dossier, mock-up and sequence domain sets must exactly match the qualified set
- deployment, desktop, mobile, interaction and factual-accuracy flags must be verified
- the campaign email standard must contain substantive guidance and research sources

## Sequence tests

Passed after hardening:

- exactly 5 touches are required
- touch numbers must be 1 through 5 in order
- initial subject is required
- follow-ups retain the original thread subject
- initial and follow-up word limits are enforced
- en dash and em dash characters are rejected
- generic low-value phrases such as `just following up` are rejected
- every touch needs a distinct purpose
- every touch must record the prospect-specific evidence used
- sequence recipient details must match the qualified record
- sequence mock-up URL must match the verified mock-up record
- the initial email must include the verified live mock-up URL

A deliberate follow-up with no evidence and a repeated purpose failed preflight as expected. A deliberate 91-word follow-up failed. A deliberate generic follow-up failed.

## Preflight integrity tests

Passed:

- scheduling is impossible before campaign preflight succeeds
- preflight stores SHA-256 hashes of the qualified, dossier, mock-up, email-standard and sequence stages
- changing a sequence after preflight invalidates scheduling
- re-validation is required after any protected stage changes

## Scheduling tests

Passed:

- 25 prospects produced exactly 125 planned messages
- no local initial-send date exceeded 5 new prospects
- the deliberate recipient holiday moved that recipient's initial send to the next working date
- later prospects filled available campaign capacity without exceeding 5 new prospects per date
- preferred 09:35 recipient-local send time was preserved across all five touches
- each follow-up landed exactly 3 recipient business days after the preceding touch
- weekends and supplied recipient non-working dates were skipped
- the final manifest records that a reply-aware provider is still required

## Ledger tests

Passed:

- qualified prospects are persisted
- seriously evaluated rejected prospects are persisted
- the deliberate no-email rejection was saved with `rejection_reason: no_verified_email`
- earlier ledger entries are preserved

## Defects found and fixed

1. Imported BuiltWith files were not re-filtered locally by commercial criteria.
2. The duplicate email exclusion set existed but was not actually applied during discovery.
3. The previous validator could pass without all later campaign stages being present.
4. Sequence QA did not require prospect-specific evidence or distinct follow-up purposes.
5. Scheduling could run without proof that the campaign had passed a full preflight.
6. Upstream files could change after validation without invalidating the schedule.
7. Holiday-shifted initial sends could exceed the intended five-new-prospects-per-date capacity.
8. Rejected serious evaluations were not persisted by the ledger synchronisation command.
9. The legacy all-in-one CLI still exposed weaker discovery, validation and scheduling paths. Those bypass paths were removed.
10. Qualification and research prompts described their handoffs in prose rather than an exact machine-readable contract. They were tightened.

## Not yet proven end to end

The following require real external access and therefore remain activation tests rather than synthetic tests:

1. Live BuiltWith Lists API retrieval with the user's authenticated BuiltWith key.
2. Live website research and browser inspection for a real 50-candidate pool.
3. Production of 25 genuine mock-ups and live deployment verification.
4. Weekly cold-email evidence refresh using current sources.
5. Loading the 125-message manifest into the selected authenticated outbound sequencer.
6. Provider-level same-thread behaviour, reply detection, bounce suppression, opt-out suppression and automatic stop-on-reply.
7. Verification that sent messages actually appear in the selected sender mailbox/provider history.

No outbound provider should be connected until those provider-level behaviours are explicitly tested with a non-prospect internal address.
