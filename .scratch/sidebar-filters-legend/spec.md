Labels: ready-for-agent

# Sidebar filters: clickable Occupation Domain, Region, and a Data Depth switch

## Problem Statement

Today the sidebar's only filter is a raw numeric fame-score floor, one per lane (People / Conflicts / Milestones). The Legend's Occupation Domain pills are decorative only — a user who wants to see, say, just scientists or just artists has no way to narrow the People lane by field of work. There's no way to narrow any lane by geography at all, even though every entity already carries region tags in the underlying data. And tuning "how much data is visible" currently means hand-typing three separate numbers with no sense of what a sensible floor looks like for each lane — there's no quick, sensible starting point to reach for.

## Solution

Three additions to the sidebar's Filters, from the user's perspective:

1. **Occupation Domain becomes clickable.** The existing Legend pills (People's 8 occupation domains) double as a filter: clicking a pill toggles that domain in or out of the People lane. Multiple domains can be active at once (OR between them); no domains active means unfiltered.
2. **A new Region filter.** One shared row of 6 geographic toggle pills (`Europe, East Asia, South Asia, Middle East, Africa, Americas`) applied identically across all three lanes at once — not a separate control per lane. Conflicts and Milestones read their native region tags directly; People's finer-grained region tags are mapped up to these 6 buckets. Multiple regions can be active at once (OR between them); no regions active means unfiltered.
3. **A "Data Depth" switch.** A three-position preset (`Curated / Expanded / Full`) that writes sensible values into the three existing numeric fame-score inputs in one click, rather than replacing them. The numeric inputs stay visible and directly editable; hand-editing any of them drops the switch to an unhighlighted state (no level shown as active, since the numbers no longer match a preset).

All three filter categories (fame floor, Occupation Domain, Region) combine with AND — an entity must clear the fame floor *and* match an active domain selection (if any) *and* match an active region selection (if any) to be visible. Within any one category, multiple selected values combine with OR.

This is a UI-only change: no new data fields, no pipeline changes. `CONTEXT.md`'s glossary already documents the resolved vocabulary (**Occupation Domain**, **Region**, **Sub-region**, **Data Depth**) and its relationship to the retired **Fame Tier** concept (ADR 0003).

## User Stories

1. As a user browsing the People lane, I want to click an Occupation Domain pill (e.g. "Science & Technology") and see only people in that domain, so that I can explore one field of human achievement at a time.
2. As a user, I want to click multiple Occupation Domain pills at once (e.g. "Arts" and "Humanities" together), so that I can see a broader slice than one domain without going back to unfiltered.
3. As a user with no Occupation Domain pills active, I want to see every person regardless of domain, so that the filter is opt-in and never silently hides everyone by default.
4. As a user, I want an active Occupation Domain pill to look visibly different from an inactive one (not just a color swatch), so that I can tell at a glance which domains are currently filtering the view.
5. As a user, I want to click a Region pill (e.g. "Europe") and see People, Conflicts, and Milestones all narrow to that region together, so that one control lets me focus the whole timeline on one part of the world instead of tuning three separate controls.
6. As a user, I want to select multiple Region pills at once (e.g. "Europe" and "Middle East"), so that I can view a combined geographic slice in one pass.
7. As a user with no Region pills active, I want every lane to show its full geographic range, so that the region filter is opt-in like the domain filter.
8. As a user filtering by Region, I want a Conflict or Milestone with no region tag at all to drop out of view (rather than showing up regardless of which region I picked), so that an active region filter behaves predictably — everything visible actually matches a region I chose.
9. As a user filtering People by Region, I want every person to be reachable by exactly one of the 6 region pills regardless of which part of the world they're from, so that no one silently disappears from a region filter just because their homeland doesn't fit neatly into a coarse bucket.
10. As a user, I want the Region pills to look and behave consistently with the Occupation Domain pills (same click-to-toggle interaction) but without invented color-coding, so that the sidebar's second filter row doesn't imply a color meaning that doesn't exist anywhere else in the app.
11. As a user, I want a "Data Depth" switch with three clearly labeled positions (Curated, Expanded, Full), so that I can quickly go from a polished, high-fame view to a much broader one without hand-tuning three numbers.
12. As a user who opens the app for the first time, I want the view to look exactly like it does today (Data Depth defaulting to "Curated"), so that this feature doesn't change anyone's first impression of the app.
13. As a user, I want picking "Expanded" or "Full" to immediately update all three lanes' numeric fame-score inputs to that level's values, so that the switch is a visible, honest shortcut rather than a hidden second filter layered on top of the numbers I can see.
14. As a user, I want to hand-edit any of the three numeric fame-score inputs after picking a Data Depth level, so that the switch never takes away the fine-grained control that already exists.
15. As a user who hand-edits a numeric input after picking a level, I want the Data Depth switch to stop showing any level as active, so that it never claims to represent numbers it didn't actually set.
16. As a user, I want Occupation Domain, Region, and Data Depth/fame-floor filters to all combine with AND, so that turning on more filters only ever narrows the view further, never surprises me by adding entities back.
17. As a user, I want my Occupation Domain, Region, and Data Depth selections to reset when I reload the page, so that filter state behaves exactly like the existing fame-score floor already does (session-only, no persistence to reason about).
18. As a keyboard/screen-reader user, I want every filter pill and the Data Depth switch to be reachable and operable without a mouse, with clear accessible names (e.g. "Filter by Science & Technology", current on/off state announced), so that the sidebar is usable without vision.
19. As a maintainer, I want the new filtering logic expressed as small, pure, independently-testable functions (mirroring the existing `filterByFameScore`), so that filter correctness can be verified without rendering anything.
20. As a maintainer, I want the People sub-region → Region mapping expressed as one explicit, complete table (not scattered conditionals), so that a future reader can see at a glance exactly which of the 22 UN sub-regions falls into which of the 6 macro-regions.
21. As a maintainer, I want no new data pipeline fields or JSON schema changes for this feature, so that it stays a pure `packages/web` change consistent with "the data is what the pipeline already ships."

## Implementation Decisions

**Occupation Domain filter (People-only):**
- The existing Legend pills in `Sidebar`'s Legend section become interactive toggle buttons (not a separate, duplicate filter row) — clicking toggles that `OccupationDomain` in/out of an active-set. Visual state: active vs. inactive styling (not relying on the swatch color alone), plus `aria-pressed`.
- New pure function `filterByOccupationDomain<T extends { occupationDomain: OccupationDomain }>(items: T[], selectedDomains: OccupationDomain[]): T[]`, added alongside `filterByFameScore` in `map-to-items.ts`. Empty `selectedDomains` returns `items` unchanged (unfiltered). Non-empty: keeps items whose `occupationDomain` is in the selected set (OR).
- New feature slice `features/filter-by-occupation-domain/` (`model/useOccupationDomainFilter.ts` owning `selectedDomains: OccupationDomain[]` + a toggle setter; `ui/` for the now-interactive pill list), mirroring `features/filter-by-fame-score/`'s shape.

**Region filter (all three lanes, one shared control):**
- Filtering happens on the raw per-lane datasets (`Person[]`/`ConflictEntry[]`/`Milestone[]`) in `TimelineCanvas.tsx`, the same layer `filterByFameScore`/`filterByOccupationDomain` already operate at — *before* `mapPeople`/`mapConflicts`/`mapMilestones` ever run, not on the `PersonItem`/`ConflictItem`/`MilestoneItem` render shapes those produce downstream inside the Lane components. So `filterByRegion` takes a `regionsOf: (item: T) => Region[]` accessor rather than requiring a `regionTags: Region[]` field directly on `T`: Conflicts/Milestones pass `(entry) => entry.regionTags` (already `Region[]`); People passes `(person) => person.regionTags.map((sub) => UN_REGION_TO_REGION[sub])`, translating its native `UnRegion[]` inline at the call site.
- New lookup table `UN_REGION_TO_REGION: Record<UnRegion, Region>` (home: `shared/config/region.ts`), a **complete** mapping — every one of the 22 `UnRegion` values resolves to exactly one of the 6 `Region` values, so no person is ever excluded from every region pill just because their sub-region doesn't fit neatly. Built from the measured People distribution (Aug 2026 dataset, 3,770 people) so every bucket's real population is known:

  | Region | Sub-regions mapped in |
  |---|---|
  | `europe` | `northern-europe`, `southern-europe`, `eastern-europe`, `western-europe` |
  | `east-asia` | `eastern-asia`, `south-eastern-asia`, `australia-and-new-zealand`, `melanesia`, `micronesia`, `polynesia` |
  | `south-asia` | `southern-asia` |
  | `middle-east` | `western-asia`, `central-asia` |
  | `africa` | `northern-africa`, `western-africa`, `middle-africa`, `eastern-africa`, `southern-africa` |
  | `americas` | `northern-america`, `central-america`, `caribbean`, `south-america` |

  Two buckets are deliberate best-fit approximations rather than clean geographic matches, worth flagging for a future reviewer: Central Asia is grouped under Middle East (Silk Road/Persianate proximity, nearest available bucket), and all of Oceania (Australia/NZ, Melanesia, Micronesia, Polynesia — 8 people total in the current dataset) is grouped under East Asia for lack of any closer bucket among the 6. If a future data refresh grows Oceania's population meaningfully, revisit whether the 6-value `Region` enum itself should gain a 7th value — out of scope here.
- If a person has multiple sub-region tags spanning different mapped regions (e.g. someone tagged both `western-europe` and `northern-america`), all of their mapped regions apply — they can match more than one region pill, consistent with the array/OR semantics already used elsewhere.
- New pure function `filterByRegion<T>(items: T[], selectedRegions: Region[], regionsOf: (item: T) => Region[]): T[]`, added alongside `filterByFameScore`/`filterByOccupationDomain` in `map-to-items.ts`. Empty `selectedRegions` returns `items` unchanged. Non-empty: keeps items with at least one resolved tag in the selected set (OR). An item resolving to no region tags at all never matches a non-empty selection, so it drops out whenever any region filter is active — this includes Conflicts/Milestones whose curated `regionTags` is genuinely `[]` (e.g. World War II).
- New feature slice `features/filter-by-region/` (`model/useRegionFilter.ts` owning `selectedRegions: Region[]` + toggle setter; `ui/` for the new pill row), mirroring the same shape as the other two filter features. Rendered in `Sidebar` as its own section, styled as plain neutral toggle chips (no color-coding — regions don't drive any color elsewhere in the app).

**Data Depth switch:**
- New `DATA_DEPTH_LEVELS` config (home: `shared/config/viewport.ts`, alongside `FAME_SCORE_BOUNDS`), one row per level, each holding the `FameScoreValues` it writes:

  | Level | People | Conflicts | Milestones |
  |---|---|---|---|
  | `curated` (launch default) | 90 | 75 | 75 |
  | `expanded` | 82 | 50 | 50 |
  | `full` | 75 | 1 | 1 |

  `curated`'s values equal today's existing `FAME_SCORE_BOUNDS.*.default` exactly — the app's first paint is unchanged by this feature.
- New pure function `matchDataDepthLevel(values: FameScoreValues): DataDepthLevelId | null` (home: alongside `DATA_DEPTH_LEVELS`) — returns the level id whose row exactly equals `values`, or `null` (custom/no level highlighted) otherwise. Used purely to derive the switch's highlighted state from the existing `FameScoreValues`; no separate "which level is active" state is stored.
- Selecting a level calls the existing `onFameScoreChange` three times (once per lane) with that level's values — no new state shape, no new prop wiring into `TimelineCanvas`. The switch UI lives in `features/filter-by-fame-score/ui/`, alongside the existing `FameScoreFilters` numeric inputs, both rendered together in `Sidebar`'s Filters section.

**Wiring (`TimelineCanvas.tsx`):**
- Extend the three existing `useMemo` filter chains. People: fame floor → `filterByOccupationDomain` → `filterByRegion`. Conflicts/Milestones: fame floor → `filterByRegion` (no domain filter — the field doesn't exist on these lanes). Filter order doesn't change the result (AND is commutative); fame-first matches today's existing precedent.
- `App.tsx` lifts `useOccupationDomainFilter()` and `useRegionFilter()` alongside the existing `useFameScoreFilters()`, passing state/setters down to both `Sidebar` (controls) and `TimelineCanvas` (application) exactly as the fame filter already does — no shared context, no new state-management pattern.

## Testing Decisions

A good test here exercises observable behavior — a pure function's input/output, or a rendered component's visible state and the callback it fires on interaction — never internal implementation details. This matches the two seams the existing fame-score filter already established:

- **Pure filter functions** (`filterByOccupationDomain`, `filterByRegion`) — unit tests in `map-to-items.test.ts`, alongside the existing `filterByFameScore` tests (empty-selection-means-unfiltered, single match, OR across multiple selected values, an empty-`regionTags` item excluded once a region filter is active).
- **`UN_REGION_TO_REGION` and `matchDataDepthLevel`** — small pure functions/tables, unit tested directly where they're defined (every `UnRegion` key covered for the mapping table; each `DATA_DEPTH_LEVELS` row plus a non-matching/custom case for `matchDataDepthLevel`).
- **New Sidebar UI** (the now-interactive Occupation Domain pills, the new Region pill row, the Data Depth switch) — RTL component tests mirroring `FameScoreFilters.test.tsx`: render with given active values, assert the correct pills/level show as active (`aria-pressed` or equivalent), assert clicking fires the right callback with the right argument.
- `Sidebar.test.tsx` extended with composition-level assertions the same way it already covers the Legend + fame inputs today — new sections render, props thread through correctly.
- No new test seam for the three `useOccupationDomainFilter`/`useRegionFilter`/Data-Depth-derived state hooks specifically — consistent with existing precedent (`useFameScoreFilters` has no direct test; thin `useState` wrappers are exercised through the UI components and pure functions instead).
- No end-to-end or visual-regression tests — not an existing pattern anywhere in this repo.

## Out of Scope

- Persistence of any filter state across reloads (matches the existing fame-floor precedent — session-only, resets on reload).
- URL-shareable or deep-linkable filter state.
- Expanding the 6-value `Region` enum to give Oceania/Central Asia their own bucket — the complete mapping above resolves coverage without a schema change; revisiting the enum itself is a separate, future decision if the data ever warrants it.
- Any filter mode other than multi-select toggle (no single-select/radio variant for any filter).
- Sidebar responsive/mobile layout — a pre-existing, separately-flagged gap (`map.md`'s "Not yet specified"), untouched by this spec.
- Retuning the Conflicts/Milestones numeric fame-score bounds/defaults themselves (`FAME_SCORE_BOUNDS` already carries a "provisional, pending manual re-tune" note predating this spec) — the Data Depth levels above reuse those existing bounds as-is.
- Any change to Conflict Category or Milestone Category (not requested; only Occupation Domain and Region are becoming filters).
- Color-coding the Region pills (explicitly decided against — plain neutral chips only).

## Further Notes

- `CONTEXT.md` already carries the resolved glossary entries this spec relies on: **Occupation Domain** (filter behavior), **Region**, **Sub-region**, and **Data Depth** (vs. the retired **Fame Tier**, ADR 0003) — updated inline during the grilling session that produced this spec, before any code changed.
- The `UN_REGION_TO_REGION` population counts (e.g. Oceania's 8 people, Central Asia's 18) are a snapshot of the current dataset; they informed the mapping's best-fit calls but aren't a data contract — a future pipeline refresh can shift them without requiring a spec change, only a possible future revisit of the two approximated buckets.
