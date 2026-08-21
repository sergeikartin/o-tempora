---
status: accepted
---

# Row Depth's per-item row moves from a client-side computation to a pipeline-precomputed field

## Context

Each lane's Row Depth packing (`assignRows` in `packages/web/src/widgets/timeline-canvas/map-to-items.ts`) ran once client-side, against the *entire* unfiltered `people`/`conflicts`/`milestones` arrays, memoized on the assumption — stated in its own comment — that those arrays "are stable references for the whole session." Payload Tier (ADR 0004) broke that assumption: `people` now grows mid-session once Tier 1 merges in. Recomputing the packing against the larger array reshuffled a handful of already-visible people's rows (e.g. James Watt, Joseph Haydn) whenever a newly-arrived Tier 1 person tied with them on the algorithm's rounded-fame-tier sort key and sorted ahead of them by start year — a real, user-visible regression: a timeline row a person has already rendered in shifting for no reason a viewer could see.

## Decision

`TimelineEntry` gains an optional `row: number` field. `packages/data-pipeline`'s Output stage (`row-assignment.ts`) computes it once per lane — People among themselves; Conflicts and Milestones together, one shared pass — before Payload Tier splits the file, using a pipeline-local port of the same fame-priority interval-packing algorithm and label-width heuristic `packages/web` used to run. `packages/web`'s `computeRowAssignment` is now a plain lookup (`new Map(people.map(p => [p.id, p.row ?? 0]))`), safe to recompute on every render regardless of how `people`/`conflicts`/`milestones` change shape — it's no longer a packing pass, so an already-visible entry's row can never move under it. The genuinely dual-use pure pieces (`estimateLabelWidthPx`, `wrapLabelLines`, `POINT_RADIUS`, `MILESTONES_LABEL_MAX_WIDTH_PX`, `AVG_CHAR_WIDTH_PX`, `yearMonthToFractionalYear`) move to `packages/shared-types` so both packages read the exact same numbers; `REFERENCE_PIXELS_PER_YEAR`/`MIN_ROW_GAP_PX`, needed only by the packing pass itself, are duplicated as literals in `row-assignment.ts` (packages/data-pipeline doesn't depend on packages/web) with a comment on both sides tying them together.

## Why

A dataset that can grow mid-session (Payload Tier) is fundamentally incompatible with "pack the whole thing once and assume it never changes." Rather than teach the client-side algorithm to grow incrementally without disturbing existing placements, moving the computation to where the *complete* dataset is already available in one place — the pipeline, before it's ever split into tiers — removes the assumption's violation entirely instead of working around it. It also deletes the packing algorithm and its pixel-interval helpers from the client bundle outright, since nothing else there needs them once rows ship as data.

## Considered Options

**Incremental client-side row assignment** (freeze each item's row once assigned; only pack newly-arrived Tier 1 items into rows around the existing, untouched placements). Rejected: real to build, but keeps the underlying fragility (a growing dataset) as something every future consumer of Row Depth has to remember to handle correctly, rather than removing the possibility of the bug class altogether.

## Consequences

- `people.tier0.json`/`people.tier1.json` (and every other lane/tier/locale file) now carry a `row` field per entry — anything reading these files directly (rather than through `packages/web`) sees it too.
- `packages/web/src/widgets/timeline-canvas/map-to-items.ts` no longer exports `assignRows` — its tests moved to `packages/data-pipeline/src/output/row-assignment.test.ts`, alongside new tests for the pipeline's `assignPersonRows`/`assignConflictsMilestonesRows`.
- Test fixtures across `packages/web`'s timeline-canvas tests that exercise row-dependent behavior now set `row` explicitly, rather than relying on the removed algorithm to derive it from overlap.

**Addendum (2026-08-21):** `REFERENCE_PIXELS_PER_YEAR`/`MIN_ROW_GAP_PX` (above) started life as literals hand-copied into `row-assignment.ts`, kept in sync with `packages/web/src/widgets/timeline-canvas/options.ts` only by a comment on each side — no compiler or test enforced the match. `MIN_ROW_GAP_PX` turned out to not need this at all: `options.ts`'s own copy was deleted in this same change (nothing in `packages/web` packs rows anymore), so the pipeline's comment was pointing at a constant that no longer existed. `REFERENCE_PIXELS_PER_YEAR` was the real risk — it's still read on both sides (the pipeline's row packing, and `Minimap.tsx`'s live Row Depth curve), and a drift between them would desync the Minimap's reported Row Depth from what actually shipped in `TimelineEntry.row`. Fixed by adding `packages/shared-types`' `REFERENCE_SCALE_PIXELS_PER_YEAR`: `row-assignment.ts` now imports it directly instead of declaring its own literal; `options.ts` keeps computing its copy live via `defaultPixelsPerYear()` (so it still auto-follows `DEFAULT_VISIBLE_YEARS`/`FALLBACK_VIEWPORT_WIDTH_PX`), guarded by an `options.test.ts` assertion that the two values agree. This doesn't reverse the ADR's dependency direction — `packages/data-pipeline` still doesn't depend on `packages/web`, both just read the same leaf value from `packages/shared-types`, which they already depended on for `estimateLabelWidthPx`/`wrapLabelLines`/`yearMonthToFractionalYear` and friends.
