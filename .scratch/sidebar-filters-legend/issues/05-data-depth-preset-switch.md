# 05 — Data Depth preset switch

**What to build:** A three-position `Curated / Expanded / Full` switch that writes preset values into the three existing per-lane numeric fame-score inputs in one click, rather than replacing them. The app launches on `Curated`, which is identical to today's existing default values (no visible change on first load). Hand-editing any numeric input afterward drops the switch to an unhighlighted state (no level shown as active).

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A `Curated / Expanded / Full` switch renders in the sidebar's Filters section, alongside the existing three numeric fame-score inputs (which remain visible and directly editable).
- [x] Clicking a level writes that level's People/Conflicts/Milestones values into the three numeric inputs (values per the spec's `DATA_DEPTH_LEVELS` table: Curated 90/75/75, Expanded 82/50/50, Full 75/1/1).
- [x] On first load, the switch shows `Curated` active and the three numeric inputs show today's existing default values, unchanged from current behavior.
- [x] After hand-editing any one of the three numeric inputs, the switch shows no level as active (values no longer match any preset row).
- [x] Clicking a level after a hand-edit overwrites all three numeric inputs with that level's values and re-highlights the switch.
- [x] New pure function deriving "which level (if any) matches the current three values" is unit tested: each of the three preset rows, plus a non-matching/custom case.
- [x] New Sidebar UI is component-tested (RTL): renders with a given `FameScoreValues`, shows the correct level highlighted (or none), clicking a level fires the existing fame-score `onChange` callback three times with the right values.
- [x] Selecting a level or hand-editing resets on page reload (session-only state, no persistence) — same as today's fame-score filter.
- [x] `packages/web` typecheck, lint, and test suite pass.

## Answer

`DATA_DEPTH_LEVELS` + `matchDataDepthLevel(values)` added to `shared/config/viewport.ts`, alongside `FAME_SCORE_BOUNDS`. `matchDataDepthLevel` takes a plain `Record<FameScoreLane, number>` (not `FameScoreValues` itself, to keep `shared/config` independent of the `features/filter-by-fame-score` slice) and returns the matching level id or `null`.

New `DataDepthSwitch` component in `features/filter-by-fame-score/ui/` (exported from the feature's existing barrel alongside `FameScoreFilters`) — stores no state of its own; the highlighted level is derived fresh from the passed-in `FameScoreValues` every render via `matchDataDepthLevel`, so a hand-edit anywhere naturally drops the highlight without extra wiring. Clicking a level calls the existing `onFameScoreChange` three times (once per lane). Rendered in `Sidebar`'s Filters section directly above the existing numeric inputs, reusing the same `fameScoreValues`/`onFameScoreChange` props — no new props on `Sidebar`, no `App.tsx`/`TimelineCanvas.tsx` changes needed.

Verified: `packages/web` typecheck, lint, `lint:boundaries`, and the full test suite pass; manually confirmed in the running dev app — clicking Full set the three inputs to 75/1/1 and broadened all three lanes, then hand-editing the People input to 80 correctly dropped the switch to no level highlighted while the Occupation Domain and Region filters stayed active and unaffected.
