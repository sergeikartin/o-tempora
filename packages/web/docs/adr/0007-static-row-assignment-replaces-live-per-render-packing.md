---
status: superseded
superseded-by: docs/adr/0005-row-assignment-moves-to-the-pipeline.md
---

# Lane rows are a static per-item identity, computed once against the full dataset

## Context

Every lane's colliding items are row-stacked by `assignRows` (`map-to-items.ts`), a greedy fame-priority interval-packing algorithm. Until now, each lane (`PeopleLane`, `ConflictsMilestonesLane`) called it fresh on every render, against whatever's currently filtered in, using the live `xScale`. That live-per-render design turned out to have a real UX problem, surfaced while investigating lane enter/exit fade transitions (`.scratch/zoom-filter-transitions/`, itself reverted for now): a person's (or Conflict's/Milestone's) row could change for two different reasons a user shouldn't notice —

- **Zoom.** `assignRows` packs in *pixel* space, and a label's rendered width doesn't scale with zoom the way a line's span does, so the same item set can pack into a different row layout at a different `pixelsPerYear`.
- **Filtering.** `assignRows` is a greedy first-fit algorithm — its result is sensitive to exactly which items are present, not just each item's own attributes. Removing or adding one item can cascade into two *unrelated* items swapping relative row order, not just a uniform reflow.

Both cause items to visibly "jump" between rows for reasons that have nothing to do with the item itself.

## Decision

Split row assignment into two steps:

1. **Static identity** — `computeStaticPersonRows`/`computeStaticConflictsMilestonesRows` (`map-to-items.ts`) run `assignRows` once against the *entire* dataset (not whatever's currently filtered) at a new fixed `REFERENCE_PIXELS_PER_YEAR` constant (`options.ts`) — never the live viewport or zoom. `TimelineCanvas` computes this once, memoized on the full `people`/`conflicts`/`milestones` arrays (stable references for the whole session), and passes the result down to each lane as a new `staticRowOf: Map<string, number>` prop.
2. **Compaction for display** — each lane narrows `staticRowOf` down to whatever it's actually rendering via `compactRows`, which re-indexes to consecutive integers starting at 0, in the *same relative order* as the static rows. This closes gaps left by filtered-out items without ever letting two simultaneously-visible items swap relative order — unlike re-running `assignRows` itself on the filtered set.

## Why

This eliminates both jump sources structurally, not by patching around them:

- Row identity never touches `xScale` at all anymore, so zoom can never change it.
- `compactRows` is a monotonic re-index of a fixed total order — it can shift the *whole visible set* up or down as a block (an expected, smooth reflow) but can never swap two visible items' relative order, which is what made filtering's row changes feel like reshuffling rather than reflowing.

It's also cheap in the common case: `assignRows` sorts by fame *tier* first (fameScore rounded to the nearest integer), so an item's row only ever depends on items in a *strictly higher* tier, never a lower one — a lower-tier item is processed later and can never bump an already-placed higher-tier item's row. That means computing rows against the full dataset gives identical results to computing them against a subset filtered by *whole tiers* — dropping every item below some tier changes nothing about the survivors' rows. Verified against the real dataset: the default Curated People view (fameScore≥90, 103 people) resolves to the same 21 rows whether `assignRows` runs over just those 103 or the full 3,733-person dataset.

This does *not* extend to an arbitrary raw-score floor that lands inside a tier rather than on its boundary (e.g. `fameScore≥88`, which splits tier 88's `[87.5, 88.5)` range) — two same-tier items are ordered by chronological tie-break, not by their exact raw score, so dropping one same-tier item can shift a *surviving* same-tier item's row (`row-assignment.test.ts`'s `assignRows can shift a same-tier survivor's row when a floor splits its tier` documents this with a concrete counter-example). This is harmless in practice only because `packages/web` never recomputes `assignRows` against a filtered subset — it always reads the single precomputed `row` this ADR ships and narrows it via `compactRows`, a monotonic re-index proven never to swap two visible items' relative order regardless of what total order it's re-indexing. A future consumer that tried to recompute `assignRows` itself against a fame-floor-filtered subset, expecting it to match the precomputed rows, would not get that guarantee.

This also extends a pattern already established by ADR 0004: the Minimap density minimap already computes its own row-depth pass against a fixed Reference Scale rather than the live zoom, specifically to stay independent of it. This decision applies that same fixed-scale idea to the lanes' own row *positions*, not just the minimap's aggregate density counts.

## Considered Options

**Reserve a permanently fixed lane height**, sized to the full dataset's worst-case row count (~1,122 rows for People at the loosest fame floor, fameScore≥75), so row 0 stays glued to a literal constant Y regardless of what's filtered in. Rejected: makes the lane permanently huge and mostly empty for the vast majority of filter settings, just to keep a handful of extreme-filter edge cases pixel-stable.

**Drop PeopleLane's "closest to the axis = most famous" convention**, anchoring row 0 at a fixed top offset the way `ConflictsMilestonesLane` already does. Rejected: the actual requirement was zero empty/gap rows under filtering while keeping today's visual convention — this option would have kept rows static but either reintroduced gaps or inverted which end of the lane the most-famous visible item sits nearest.

**Keep re-running `assignRows` against the live filtered set** (today's original design). Rejected: this is the actual root cause described above, not a fix for it.

## Consequences

- `PeopleLane`/`ConflictsMilestonesLane` both take a new required `staticRowOf: Map<string, number>` prop; their own per-render `assignRows` calls are gone, replaced by `compactRows`.
- `TimelineCanvas` owns computing both static row maps, keyed on the full, unfiltered `people`/`conflicts`/`milestones` props.
- Non-fame filters (Occupation Domain, Region) can leave visually sparse or scattered row numbers among the currently-visible set, since a domain-only filter doesn't correlate with the fame-tier order rows are assigned in. `compactRows` still closes gaps in the *rendered* range — there's never a blank row band — but the specific rows a domain-filtered item lands on aren't as tightly packed as a fame-only filter's would be. Confirmed acceptable.
- Tests that render a lane directly now construct their own `staticRowOf` via `computeStaticPersonRows`/`computeStaticConflictsMilestonesRows` over the same array they render (see `PeopleLane.test.tsx`/`ConflictsMilestonesLane.test.tsx`), rather than getting row assignment for free.

**Addendum (2026-08-19):** the Minimap independently re-ran `assignRows` on its own filtered input to compute hover-tooltip Row Depth, instead of reusing the static identity above — order-sensitive to exactly which items are present, so its reported depth could diverge from what the lanes actually render under a filter. Fixing that one call site (`3a1e92b`) still left three consumers (`PeopleLane`, `ConflictsMilestonesLane`, `Minimap`) each trusting a `staticRowOf: Map<string, number>` prop and calling `compactRows` on it themselves — correct only because every call site was hand-edited to agree, with nothing stopping a future consumer from narrowing it some other way. `computeStaticPersonRows`, `computeStaticConflictsMilestonesRows`, and `compactRows` (`map-to-items.ts`) are now module-private, called only from a new `computeRowAssignment(people, conflicts, milestones)`, which returns `{ personRowFor, eventsRowFor }` — each a `(ids: string[]) => Map<string, number>` resolver. `TimelineCanvas` computes this once and passes `personRowFor`/`eventsRowFor` down; no consumer prop is a raw row map anymore, and none of them know a static identity + compaction step exists underneath. `assignRows` itself stays exported — it's a generic interval-packing primitive one level below Row Assignment, not specific to Person/Conflict/Milestone shapes, and keeps its own direct unit tests.
