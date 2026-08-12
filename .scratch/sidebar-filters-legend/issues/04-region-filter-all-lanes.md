# 04 — Region filter across all three lanes

**What to build:** A new, single shared Region filter control (6 geographic toggle pills: Europe, East Asia, South Asia, Middle East, Africa, Americas) that narrows People, Conflicts, and Milestones together — one control, not one per lane. Multiple regions can be active at once (an entity matching any active region stays visible); with no regions active, every lane is unfiltered by region. Combines with AND against the fame-score floor and, for People, the Occupation Domain filter.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A new Region pill row renders in the sidebar, styled as plain neutral toggle chips (no color-coding).
- [x] Selecting zero regions shows every lane unfiltered by region.
- [x] Selecting one or more regions shows only entities tagged with at least one selected region (OR across selections).
- [x] Conflicts and Milestones filter directly on their existing native region tags.
- [x] People filter via a complete mapping from their 22-value sub-region tags up to the 6 region values — every sub-region resolves to exactly one region value, none excluded from every pill. (See the spec's `UN_REGION_TO_REGION` table, including its two documented best-fit calls: Central Asia → Middle East, Oceania → East Asia.)
- [x] An entity with no region tags at all (e.g. a Conflict/Milestone with an empty `regionTags`) is excluded whenever any region filter is active.
- [x] The region filter combines via AND with the fame-score floor and (for People) the Occupation Domain filter.
- [x] New pure function (alongside `filterByFameScore`) is unit tested: empty selection unchanged, OR semantics, empty-`regionTags` items excluded once a filter is active.
- [x] The `UN_REGION_TO_REGION` mapping table is unit tested for full coverage — every one of the 22 sub-region values is asserted to resolve to its documented region.
- [x] New Sidebar UI is component-tested (RTL): renders pills reflecting given active regions, clicking a pill fires the right callback.
- [x] Selecting regions resets on page reload (session-only state, no persistence).
- [x] `packages/web` typecheck, lint, and test suite pass.

## Answer

New `features/filter-by-region` slice (`useRegionFilter` owning `selectedRegions: Region[]` + toggle setter; `RegionFilters` rendering the 6 plain neutral pills) and `shared/config/region.ts` (the complete `UN_REGION_TO_REGION` lookup + `REGION_LABELS`).

Mid-implementation correction from the spec's original plan: filtering in `TimelineCanvas.tsx` happens on the *raw* per-lane datasets (`Person[]`/`ConflictEntry[]`/`Milestone[]`), before `mapPeople`/`mapConflicts`/`mapMilestones` ever run — not on the `PersonItem`/`ConflictItem`/`MilestoneItem` render shapes those produce downstream inside the Lane components. So `filterByRegion<T>(items, selectedRegions, regionsOf: (item: T) => Region[])` takes a region-accessor rather than requiring `regionTags: Region[]` directly on `T`: Conflicts/Milestones pass `(entry) => entry.regionTags` (already `Region[]`); People passes `(person) => person.regionTags.map((sub) => UN_REGION_TO_REGION[sub])`, translating its native `UnRegion[]` inline at the call site in `TimelineCanvas.tsx`. The spec (`spec.md`) was updated to match this corrected design — the originally-planned `regionTags` additions to the `*Item` interfaces were reverted as unused.

Verified: `packages/web` typecheck, lint, `lint:boundaries`, and the full test suite pass; manually confirmed in the running dev app that the Region filter narrows all three lanes together and combines correctly (AND) with an active Occupation Domain filter — e.g. Science & Technology + Europe together excludes Edison/Oppenheimer (American) and al-Khwarizmi/Euclid (Middle East/Africa) from People while narrowing Conflicts/Milestones to Europe-tagged entries.
