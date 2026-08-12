# 05 — Data Depth preset switch

**What to build:** A three-position `Curated / Expanded / Full` switch that writes preset values into the three existing per-lane numeric fame-score inputs in one click, rather than replacing them. The app launches on `Curated`, which is identical to today's existing default values (no visible change on first load). Hand-editing any numeric input afterward drops the switch to an unhighlighted state (no level shown as active).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A `Curated / Expanded / Full` switch renders in the sidebar's Filters section, alongside the existing three numeric fame-score inputs (which remain visible and directly editable).
- [ ] Clicking a level writes that level's People/Conflicts/Milestones values into the three numeric inputs (values per the spec's `DATA_DEPTH_LEVELS` table: Curated 90/75/75, Expanded 82/50/50, Full 75/1/1).
- [ ] On first load, the switch shows `Curated` active and the three numeric inputs show today's existing default values, unchanged from current behavior.
- [ ] After hand-editing any one of the three numeric inputs, the switch shows no level as active (values no longer match any preset row).
- [ ] Clicking a level after a hand-edit overwrites all three numeric inputs with that level's values and re-highlights the switch.
- [ ] New pure function deriving "which level (if any) matches the current three values" is unit tested: each of the three preset rows, plus a non-matching/custom case.
- [ ] New Sidebar UI is component-tested (RTL): renders with a given `FameScoreValues`, shows the correct level highlighted (or none), clicking a level fires the existing fame-score `onChange` callback three times with the right values.
- [ ] Selecting a level or hand-editing resets on page reload (session-only state, no persistence) — same as today's fame-score filter.
- [ ] `packages/web` typecheck, lint, and test suite pass.
