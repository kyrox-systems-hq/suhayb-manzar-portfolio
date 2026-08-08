# One-Week and Two-Week Campaign Batching

Serial: WEBLEADS-BATCH-20260808-001

The system keeps the operational unit at **25 prospects per week** even when two weeks of material are prepared in one weekend.

Do not turn a two-week batch into one 50-prospect campaign. Use two weekly campaign folders so the five-new-prospects-per-working-day rule, follow-up timing, results analysis and provider state remain clean.

## One-week build

For the next Monday `<week-1>`:

1. Initialise `<week-1>`.
2. Run a fresh authenticated BuiltWith pull.
3. Live-check the pool.
4. Qualify exactly 25.
5. Sync the permanent ledger.
6. Complete research, mock-ups, theory review and sequences.
7. Validate, schedule and provider-preflight the 25-prospect campaign.

## Two-week build

For the next Monday `<week-1>` and the Monday seven days later `<week-2>`:

### Build Week 1 first

Complete discovery and qualification for `<week-1>` and run ledger sync **before** discovering `<week-2>`.

That permanently excludes Week 1's 25 businesses from Week 2 discovery.

### Then discover Week 2

Run a second fresh authenticated BuiltWith discovery for `<week-2>` after Week 1 ledger sync.

The second pull applies the same commercial and freshness filters but starts with the updated permanent exclusion ledger, so the two weekly batches cannot intentionally reuse the same business, domain or verified contact.

### Build both weeks during the same weekend

Week 2 research, mock-ups and sequence writing may be completed immediately after Week 2 qualification.

The provider may also be loaded during the same weekend if Week 2's source, browser, public-email, campaign and provider preflights all pass while still fresh and every scheduled send remains in the future.

This is the preferred way to prepare 50 businesses at once while preserving two independent 25-prospect weekly campaigns.

## Do not reuse Week 1 discovery data as Week 2 discovery

Even when the campaigns are built back-to-back, Week 2 runs its own authenticated BuiltWith query and records its own retrieval run ID, provenance and payload hashes.

This prevents a two-week batch from quietly becoming a duplicated or cached copy of the first week's source data.

## If Week 2 cannot be provider-loaded during the same build session

Do not bypass freshness checks.

Re-run any source, site or contact verification that has expired before provider preflight. If that invalidates a prospect, replace it through the normal qualification flow rather than sending stale outreach.

## Result

A two-week weekend build produces:

- 2 fresh BuiltWith retrieval runs
- 2 independent weekly campaign folders
- 50 unique qualified businesses
- 50 verified live mock-ups
- 50 five-touch personalised sequences
- 250 planned messages
- 5 new prospects per recipient working day in each week
- one permanent ledger covering both batches
