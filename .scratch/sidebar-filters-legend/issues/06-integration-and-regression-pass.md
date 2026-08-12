# 06 — Integrate all three filters and verify combined behavior

**What to build:** With Occupation Domain (03), Region (04), and Data Depth (05) each landed independently, confirm the sidebar composes all three correctly and that they combine as one coherent filtering system — all three categories AND'd together, each category's own OR-across-selections intact — rather than just trusting each ticket's isolated wiring.

**Blocked by:** 03, 04, 05

**Status:** resolved

- [x] The sidebar renders Legend/Occupation Domain pills, the Region pill row, and the Data Depth switch + numeric inputs together with no layout regressions.
- [x] A concrete combined scenario is verified end-to-end: with an Occupation Domain, a Region, and a Data Depth level all active simultaneously, the People lane shows only entities satisfying all three (AND across categories) — confirmed via a test or documented manual check, not just each filter checked in isolation.
- [x] Toggling any one filter (domain, region, fame floor, or Data Depth) while the other two remain active updates the visible set correctly without resetting the other active filters.
- [x] Hand-editing a fame-score input while Occupation Domain and/or Region filters are active still drops the Data Depth switch to its unhighlighted state, and the domain/region selections are unaffected.
- [x] Full `packages/web` test suite, typecheck, and lint pass on the merged result of all three tickets.
- [x] Manual smoke test in the running dev app: exercise all three filter types individually and in combination; confirm all three lanes (People, Conflicts, Milestones) update as expected.
- [x] `Sidebar.tsx`, `App.tsx`, and `TimelineCanvas.tsx` cleanly compose all three features' wiring with no leftover TODOs or dead code from any individual ticket's implementation.

## Answer

Ran the dev app (`npm run dev --workspace packages/web`) and drove it via Playwright: activated Science & Technology (Occupation Domain) → People narrowed to 22 scientists, Conflicts/Milestones unaffected. Added Europe (Region) on top → People narrowed further to 18 (dropped Edison/Oppenheimer/al-Khwarizmi/Euclid — non-European), Conflicts/Milestones both narrowed to Europe-tagged entries too, confirming the Region control genuinely applies across all three lanes at once. Clicked Data Depth's Full → inputs became 75/1/1, all three lanes broadened, Domain/Region selections stayed active and pressed throughout. Hand-edited the People input to 80 → Data Depth switch correctly dropped to no level highlighted, while Science & Technology and Europe remained active — full AND-across-categories behavior confirmed live, not just per-ticket in isolation.

Full regression: `packages/web` typecheck, `lint:boundaries` (Steiger), `lint` (ESLint), the full test suite (196 tests, 20 files), and a production `build` all pass clean on the merged result of tickets 03–05. No dead code or leftover TODOs — the spec's original `PersonItem`/`ConflictItem`/`MilestoneItem` `regionTags` plan (found unnecessary once ticket 04 clarified that filtering happens pre-mapping) was fully reverted rather than left half-wired.
