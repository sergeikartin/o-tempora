---
status: accepted
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

It's also cheap in the common case: `assignRows` sorts by fame tier first, so an item's row only ever depends on *more-famous* items, never less-famous ones — a lower-fame item is processed later and can never bump an already-placed higher-fame item. That means computing rows against the full dataset gives identical results to computing them against just the currently-filtered set, for any filter that only raises the fame floor. Verified against the real dataset: the default Curated People view (fameScore≥90, 103 people) resolves to the same 21 rows whether `assignRows` runs over just those 103 or the full 3,733-person dataset.

This also extends a pattern already established by ADR 0004: the Mountain Profile density minimap already computes its own row-depth pass against a fixed Reference Scale rather than the live zoom, specifically to stay independent of it. This decision applies that same fixed-scale idea to the lanes' own row *positions*, not just the minimap's aggregate density counts.

## Considered Options

**Reserve a permanently fixed lane height**, sized to the full dataset's worst-case row count (~1,122 rows for People at the loosest fame floor, fameScore≥75), so row 0 stays glued to a literal constant Y regardless of what's filtered in. Rejected: makes the lane permanently huge and mostly empty for the vast majority of filter settings, just to keep a handful of extreme-filter edge cases pixel-stable.

**Drop PeopleLane's "closest to the axis = most famous" convention**, anchoring row 0 at a fixed top offset the way `ConflictsMilestonesLane` already does. Rejected: the actual requirement was zero empty/gap rows under filtering while keeping today's visual convention — this option would have kept rows static but either reintroduced gaps or inverted which end of the lane the most-famous visible item sits nearest.

**Keep re-running `assignRows` against the live filtered set** (today's original design). Rejected: this is the actual root cause described above, not a fix for it.

## Consequences

- `PeopleLane`/`ConflictsMilestonesLane` both take a new required `staticRowOf: Map<string, number>` prop; their own per-render `assignRows` calls are gone, replaced by `compactRows`.
- `TimelineCanvas` owns computing both static row maps, keyed on the full, unfiltered `people`/`conflicts`/`milestones` props.
- Non-fame filters (Occupation Domain, Region) can leave visually sparse or scattered row numbers among the currently-visible set, since a domain-only filter doesn't correlate with the fame-tier order rows are assigned in. `compactRows` still closes gaps in the *rendered* range — there's never a blank row band — but the specific rows a domain-filtered item lands on aren't as tightly packed as a fame-only filter's would be. Confirmed acceptable.
- Tests that render a lane directly now construct their own `staticRowOf` via `computeStaticPersonRows`/`computeStaticConflictsMilestonesRows` over the same array they render (see `PeopleLane.test.tsx`/`ConflictsMilestonesLane.test.tsx`), rather than getting row assignment for free.
