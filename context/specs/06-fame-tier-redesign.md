# Spec: Fame Tier Redesign (Unit — data-pipeline only)

## Goal

Replace the arbitrary top-N fame-tier ceilings in `transform/score.ts`
(`PEOPLE_FAME_TIER_CEILING = 3000`, `EVENTS_FAME_TIER_CEILING = 1000`)
with 3 named, meaningfully-defined tiers — `general-public`, `educated`,
`specialist` — expressed as sitelink-count floors shared across both
lanes (people; events+inventions combined). `fameScore` (sitelinks)
stays the only field on `Person`/`HistoricalEvent`; the tier concept
lives purely as pipeline-side threshold constants, not a stored field.

**Out of scope:** the frontend's fame-tier selector (`features/filter-by-fame-tier`)
that will eventually read these thresholds — that's Unit 9 per
`context/specs/00-build-plan.md`, a separate unit since it spans a
different package.

## Design

### Threshold values

Validated against the real dataset (`packages/shared-types/src/data/*.json`):

| Tier | Min sitelinks | People included | Events included |
|---|---|---|---|
| general-public | 100 | 162 | 45 |
| educated | 50 | 960 | 333 |
| specialist | 30 | 2746 (all) | 866 (all) |

Same thresholds apply to both lanes (people and events have near-identical
sitelink distributions in the real data, confirmed by percentile check).
Nesting (Invariant 3 in `CLAUDE-decisions.md`) holds by construction: each
tier is a `fameScore >=` cutoff on the same field, so
general-public ⊂ educated ⊂ specialist automatically — no re-ranking
needed when the tier changes.

### Behavior change, called out explicitly

Today, `scoreAndRank` takes the top N *by count*. Since both lanes'
candidate pools are currently smaller than their ceilings (2746 < 3000,
866 < 1000), every fetched candidate ships today regardless of how low
its sitelink count is — the ceiling doesn't currently bind. After this
change, inclusion becomes a **hard sitelink floor of 30**. It's a
coincidence that today's minimum candidate happens to sit at exactly 30
sitelinks — this is the intended semantic of choosing fixed sitelink
thresholds over fixed top-N, not a bug: a future Fetch re-run will no
longer return candidates between 20-29 sitelinks at all (see Fetch
change below), so this floor is enforced at the source, not just in
Score.

### `transform/score.ts` changes

```ts
export const FAME_TIER_MIN_SITELINKS = {
  generalPublic: 100,
  educated: 50,
  specialist: 30,
} as const;

export type FameTier = keyof typeof FAME_TIER_MIN_SITELINKS;

export function scoreAndRank<T extends { sitelinks: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS.specialist)
    .sort((a, b) => b.sitelinks - a.sitelinks);
}
```

- `transform/index.ts`: both call sites drop their ceiling argument —
  `scoreAndRank(tagged)` / `scoreAndRank([...historical, ...inventions])`.
  Remove the now-unused `PEOPLE_FAME_TIER_CEILING`/`EVENTS_FAME_TIER_CEILING`
  import.
- New `transform/score.test.ts` (none exists today) covering: rows below
  the specialist floor are dropped, remaining rows sort descending by
  sitelinks, and tier nesting holds (slicing the specialist-floor output
  by `>= educated`/`>= generalPublic` produces the expected subset
  counts).

### Fetch simplification: stop fetching data Score will always discard

All three query builders (`fetch/queries/people.ts`,
`historical-events.ts`, `inventions.ts`) currently hardcode
`FILTER(?sitelinks > 20)`. Since Score will now unconditionally drop
anything under 30 sitelinks, fetching 20-29-sitelink candidates is pure
waste (SPARQL page budget, row count, raw JSON size) — so Fetch's floor
moves up to match Score's specialist floor exactly.

Rather than hardcoding `30` independently in three files (three points
that could drift out of sync with each other, on top of staying synced
with Score), introduce one shared constant:

`fetch/queries/min-sitelinks.ts`:
```ts
// Must match FAME_TIER_MIN_SITELINKS.specialist in transform/score.ts —
// fetching anything below this floor is wasted, since Score always
// discards it.
export const MIN_SITELINKS = 30;
```

- `people.ts`, `historical-events.ts`, `inventions.ts` import
  `MIN_SITELINKS` and interpolate `FILTER(?sitelinks >= ${MIN_SITELINKS})`
  in place of the hardcoded `> 20`.
- `people.ts`'s existing comment (justifying `20` as a candidate-pool-growth
  tradeoff toward the old 3000-count ceiling) is rewritten to explain the
  real reason: match Score's specialist floor so Fetch never returns rows
  that always get discarded downstream.
- `people.test.ts`'s existing assertion (`FILTER(\?sitelinks > 20)`)
  updates to assert `FILTER(?sitelinks >= 30)`.
- `historical-events.ts`/`inventions.ts` have the identical filter but no
  test coverage for it today — add one equivalent test per file, since
  this unit directly changes that behavior.

### Fetch re-run required

This is a Fetch-side query change, so `npm run fetch` must be re-run to
regenerate all raw snapshots before `npm run build-data` reflects the new
floor end-to-end. (Existing raw snapshots were fetched at the old `> 20`
threshold; Score's new `>= 30` filter alone will already produce a
correct, smaller output even without a re-fetch, but re-fetching keeps
Fetch's own output consistent with its new declared threshold rather than
silently retaining rows a fresh fetch would never produce.)

## Implementation

1. `fetch/queries/min-sitelinks.ts` — new shared constant.
2. Update `people.ts`, `historical-events.ts`, `inventions.ts` to import
   it and filter `>= MIN_SITELINKS`; rewrite `people.ts`'s stale
   rationale comment.
3. Update `people.test.ts`'s assertion; add new `historical-events.test.ts`
   and `inventions.test.ts` files (neither exists today) asserting the
   `FILTER(?sitelinks >= 30)` behavior for each.
4. `transform/score.ts` — replace the two ceiling constants with
   `FAME_TIER_MIN_SITELINKS`, rewrite `scoreAndRank` to filter-then-sort
   with no count slice.
5. `transform/index.ts` — drop ceiling arguments from both
   `scoreAndRank` call sites; remove the dead import.
6. New `transform/score.test.ts` — filtering, sorting, and nesting
   behavior.
7. Re-run `npm run fetch --workspace packages/data-pipeline` (regenerates
   all raw snapshots at the new floor), then
   `npm run build-data --workspace packages/data-pipeline`.
8. Spot-check: `people.json`/`events.json` contain nothing below 30
   sitelinks; slicing either output by `>= 50` / `>= 100` matches the
   counts in the Threshold values table (allowing for real-world drift
   from a live re-fetch).
9. Update `CLAUDE-activeContext.md` (mark this Next-Up item done) since
   the frontend fame-tier selector work is a separate, still-unspecced
   unit.

## Dependencies

None new. Reuses existing `data-pipeline` tooling (`node:test`, `tsx`).

## Verification Checklist

1. `FAME_TIER_MIN_SITELINKS` nesting holds: filtering `specialist`-floor
   output by `>= educated` and `>= generalPublic` produces strict subsets
   (Invariant 3), verified by slicing the array, not re-querying.
2. No person/event in the rebuilt `people.json`/`events.json` has
   `fameScore < 30`.
3. All three Fetch query builders emit `FILTER(?sitelinks >= 30)`;
   `MIN_SITELINKS` is imported, not duplicated as a literal, in any of
   the three.
4. `people.test.ts` and the new historical-events/inventions tests assert
   the new filter; all pass.
5. New `transform/score.test.ts` passes (drop-below-floor, descending
   sort, nesting).
6. `npm run typecheck --workspace packages/data-pipeline` clean, strict
   mode, no `any`.
7. `npm run test --workspace packages/data-pipeline` passes in full.
8. Fetch stage still writes only to `data/raw/` and still never
   merges/scores/tags (Invariant 8) — the threshold change is a query
   parameter, not new Fetch-side logic.
9. `packages/shared-types/src/data/*.json` only changes via
   `npm run build-data`, never hand-edited (Invariant 7).
10. `CLAUDE-activeContext.md` updated in the same unit.
