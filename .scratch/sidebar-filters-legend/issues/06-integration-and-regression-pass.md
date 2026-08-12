# 06 — Integrate all three filters and verify combined behavior

**What to build:** With Occupation Domain (03), Region (04), and Data Depth (05) each landed independently, confirm the sidebar composes all three correctly and that they combine as one coherent filtering system — all three categories AND'd together, each category's own OR-across-selections intact — rather than just trusting each ticket's isolated wiring.

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] The sidebar renders Legend/Occupation Domain pills, the Region pill row, and the Data Depth switch + numeric inputs together with no layout regressions.
- [ ] A concrete combined scenario is verified end-to-end: with an Occupation Domain, a Region, and a Data Depth level all active simultaneously, the People lane shows only entities satisfying all three (AND across categories) — confirmed via a test or documented manual check, not just each filter checked in isolation.
- [ ] Toggling any one filter (domain, region, fame floor, or Data Depth) while the other two remain active updates the visible set correctly without resetting the other active filters.
- [ ] Hand-editing a fame-score input while Occupation Domain and/or Region filters are active still drops the Data Depth switch to its unhighlighted state, and the domain/region selections are unaffected.
- [ ] Full `packages/web` test suite, typecheck, and lint pass on the merged result of all three tickets.
- [ ] Manual smoke test in the running dev app: exercise all three filter types individually and in combination; confirm all three lanes (People, Conflicts, Milestones) update as expected.
- [ ] `Sidebar.tsx`, `App.tsx`, and `TimelineCanvas.tsx` cleanly compose all three features' wiring with no leftover TODOs or dead code from any individual ticket's implementation.
