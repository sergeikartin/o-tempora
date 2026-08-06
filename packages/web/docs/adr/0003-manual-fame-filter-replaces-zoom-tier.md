---
status: accepted
supersedes: 0002-fame-tier-drives-zoom.md
---

# Manual sidebar fame-score filters replace zoom-coupled Fame Tier

## Context

A new always-visible sidebar (`.scratch/sidebar-filters-legend/`) was scoped to carry two sections: a Legend of People's 8 `OccupationDomain` colors, and a per-lane Fame filter. Once a manual, user-facing filter exists, it directly conflicts with ADR 0002's decision to gate entity density automatically off zoom level (`fameTierForViewport`) — two mechanisms competing to control the same thing (which entities render) would be confusing and redundant, so one had to give way.

## Decision

The sidebar's Filters section exposes one raw-`fameScore` numeric floor per lane (People/Wars/Discoveries), directly settable by the user, and **fully replaces** ADR 0002's zoom-coupled Fame Tier system for end users. Zoom goes back to controlling only time-scale. The CORE/NOTABLE/EXHAUSTIVE tier vocabulary, `fameTierForViewport`/`fameTierForVisibleYears`, `FAME_TIER_YEAR_BOUNDS`, and the `FAME_TIER_MIN_HPI`/`FAME_TIER_MIN_SITELINKS_WARS`/`FAME_TIER_MIN_SITELINKS_DISCOVERIES` tables are all removed from `packages/web` (the data-pipeline's underlying `generalPublic`/`educated`/`specialist` tier concept is untouched — it still governs what ships to `people.json`/`wars.json`/`discoveries.json` in the first place). The read-only `fameTierIndicator` span next to the zoom buttons is removed with nothing replacing it. Each lane's filter defaults to the old CORE tier's threshold (People 90, Wars 100, Discoveries 200) so first paint is unchanged; bounds are the lane's real `fameScore` range (People 75–100, Wars 30–193, Discoveries 50–386). Filter state is session-only — no persistence across reloads.

## Why

A manual filter and an automatic zoom-driven one both claim the same job (deciding which entities are dense enough to render); keeping both would mean a user's explicit filter choice could be silently overridden by how far they've zoomed, or vice versa — surprising either way. The map's standing preference (settled during destination-grilling) was a full replace rather than coexistence or an additive ceiling, since a single, legible density control the user has direct authority over is simpler than reconciling two.

## Considered Options

**Coexistence** (manual filter as an additional ceiling on top of the zoom-derived tier). Rejected per the map's standing preference: two interacting density controls is more state for the user to reason about than one, for no benefit once a direct manual control exists — the whole point of ADR 0002's automatic gating was to stand in for a manual selector that didn't exist yet.

**Keep the `FAME_TIER_*` tables as preset/reference values on the sliders**, rather than deleting them outright. Rejected: the tables encoded exactly three fixed points (CORE/NOTABLE/EXHAUSTIVE), but the new filter is a continuous numeric floor, not a three-way choice — the tables added nothing a plain default per lane didn't already cover, and every value they held is already documented in `shared/config/viewport.ts`'s `FAME_SCORE_BOUNDS` table.

## Consequences

- `packages/web/src/shared/config/viewport.ts` drops `FameTierName`/`FAME_TIER_YEAR_BOUNDS`/`FAME_TIER_MIN_HPI`/`FAME_TIER_MIN_SITELINKS_WARS`/`FAME_TIER_MIN_SITELINKS_DISCOVERIES`, replaced by a single `FAME_SCORE_BOUNDS: Record<FameScoreLane, { min, max, default }>` table. `options.ts` drops `fameTierForVisibleYears`/`fameTierForViewport`.
- `TimelineCanvas.tsx` takes the feature's `FameScoreValues` as one plain prop (no longer derived from `pixelsPerYear`); `filterByFameScore` is unchanged, just called with a user-set value instead of a tier-derived one.
- A new `features/filter-by-fame-score` slice owns the session-only filter state (`useFameScoreFilters`) and the presentational `FameScoreFilters` control; a new `widgets/sidebar` slice composes it with the Legend. `App.tsx` now renders `Sidebar` alongside `TimelineCanvas`, wiring the shared filter state between them.
- `docs/active-context.md`'s in-progress progressive fame-tier-loading performance plan (deferring NOTABLE/EXHAUSTIVE-tier entries until the user zooms in far enough) loses its zoom-keyed premise and needs to be re-derived fame-floor-keyed instead, if picked back up — flagged there, not solved here.
