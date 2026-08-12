# 02 — Milestone Category Group filter

**What to build:** The sidebar's new "Conflicts & Milestones" section (create it if not already present) gains 3 toggle pills — Knowledge & Culture, Technology & Industry, Society & Governance — each swatched with the exact color the Milestones lane already renders that group in. Clicking a pill toggles that group in/out of the Milestones lane (multi-select OR; no pills active means unfiltered). Combines via AND with the existing Region and Fame Score/Data Depth filters.

**Blocked by:** 01

**Status:** done

- [x] New pure function `filterByMilestoneCategoryGroup<T extends { category: MilestoneCategory }>(items, selectedGroups)` added alongside `filterByRegion`/`filterByOccupationDomain`/`filterByFameScore` in `map-to-items.ts`.
- [x] Empty `selectedGroups` returns items unchanged (unfiltered); non-empty keeps items whose `MILESTONE_CATEGORY_TO_GROUP[item.category]` is in the selected set (OR across selections).
- [x] New `features/filter-by-milestone-category-group/` slice: `model/useMilestoneCategoryGroupFilter.ts` (bare `useState<MilestoneCategoryGroup[]>` + toggle setter) and `ui/MilestoneCategoryGroupFilters.tsx` (3 pills, swatch + label + `aria-pressed`, mirroring `OccupationDomainFilters.tsx`'s shape).
- [x] Each pill's swatch color matches `MILESTONE_CATEGORY_GROUP_COLORS` exactly (imported from `shared/config` — see ticket 01's Comments for why it isn't in `options.ts`).
- [x] An active pill is visually distinguishable from an inactive one (not relying on swatch color alone) — bolder border/background/font-weight, same as `OccupationDomainFilters`' `pillActive`.
- [x] Wired into `TimelineCanvas.tsx`'s Milestones `useMemo` chain: fame floor → `filterByRegion` → `filterByMilestoneCategoryGroup`.
- [x] `App.tsx` lifts `useMilestoneCategoryGroupFilter()` and threads state/setter to `Sidebar` and `TimelineCanvas`.
- [x] `Sidebar.tsx` renders a "Conflicts & Milestones" section containing `MilestoneCategoryGroupFilters`, placed after the existing "People" section (created by this ticket; ticket 03 landed in the same unit of work and added the Conflicts toggle to the same section).
- [x] Filtering Milestones by group has no effect on Conflicts or People — verified via manual smoke test in the dev app.
- [x] Combines via AND with Region and Fame Score — e.g. Technology & Industry + Europe shows only milestones matching both (filter chain composition, verified manually).
- [x] New pure function is unit tested: empty selection unchanged, OR semantics across multiple selected groups.
- [x] New Sidebar UI is component-tested (RTL): renders pills reflecting given active groups, clicking a pill fires the right callback.
- [x] Selecting groups resets on page reload (session-only, no persistence) — plain `useState`, no persistence wired.
- [x] `packages/web` typecheck, lint, and test suite pass.

## Comments

Implemented 2026-08-12, together with tickets 01 and 03 in one unit of work (see ticket 04's integration notes).

**Follow-up (2026-08-12, same day):** this ticket's `features/filter-by-milestone-category-group/` slice (`useMilestoneCategoryGroupFilter`, `MilestoneCategoryGroupFilters`) was deleted and folded into `features/filter-conflicts-milestones/` — the user asked for the whole "Conflicts & Milestones" section to be one multi-select filter, the same shape as Region/Occupation Domain, rather than this ticket's 3-pill group filter sitting next to ticket 03's separate Conflicts control. See `spec.md`'s "Amendment 2" and ticket 03's matching follow-up note for the full rationale. `filterByMilestoneCategoryGroup` (the pure function) survives with a widened signature — it now takes the shared `ConflictsMilestonesFilterValue[]` selection instead of a `MilestoneCategoryGroup[]`-only one, since `'conflicts'` never matches a `MilestoneCategoryGroup` anyway.
