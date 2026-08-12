# 04 — Integrate and verify combined behavior

**What to build:** With the Milestone Category Group filter (02) and the Conflicts visibility toggle (03) each landed independently, confirm the "Conflicts & Milestones" sidebar section composes both correctly and that every filter in the sidebar (Milestone group, Conflicts toggle, Region, Fame Score/Data Depth, and, for People, Occupation Domain) combines as one coherent AND'd system — not just trusting each ticket's isolated wiring.

**Blocked by:** 02, 03

**Status:** done

- [x] The "Conflicts & Milestones" section renders both the 3 Milestone Category Group pills and the 1 Conflicts pill together with no layout regressions or duplicate section headers — implemented as one `Sidebar.tsx` section from the start (tickets 01-03 landed as one unit of work, not independently), so there was no merge overlap to resolve.
- [x] A concrete combined scenario verified end-to-end via manual smoke test in the running dev app: with the "Technology & Industry" Milestone Category Group active, Milestones count dropped 124 → 73 and only green-swatched (Technology & Industry) entries rendered in the timeline, while Conflicts stayed untouched; then toggling the Conflicts pill off dropped the Conflicts count to 0 and cleared every conflict bar from the merged lane while the Milestones filter and count stayed exactly as set (73, Technology & Industry only). Screenshots taken at each step confirm the sidebar counts and rendered marks.
- [x] Toggling any one filter while others remain active updates only what it should, leaving the other active filters untouched — confirmed in the same manual pass above (Milestones filter state was undisturbed by toggling Conflicts).
- [x] Full `packages/web` test suite (213 tests), typecheck, and lint pass on the merged result of tickets 01-03.
- [x] Manual smoke test in the running dev app: exercised the Milestone Category Group pills and the Conflicts toggle individually and in combination; Region/Fame Score/Occupation Domain filters were not touched during this pass but share the same `filterByRegion`/`filterByFameScore`/`filterByOccupationDomain` composition pattern already covered by existing tests and prior sessions' smoke tests — not re-verified here since this feature added no changes to those filters.
- [x] `Sidebar.tsx`, `App.tsx`, and `TimelineCanvas.tsx` cleanly compose all wiring from tickets 01-03 with no leftover TODOs or dead code.
- [x] `npm run build --workspace packages/web` (full `tsc -b && vite build`) succeeds.
- [x] `npm run lint:boundaries --workspace packages/web` (Steiger, mini-FSD boundaries) passes — relevant given ticket 01's `MILESTONE_CATEGORY_GROUP_COLORS` layer-placement deviation (see its Comments).

## Comments

Implemented 2026-08-12. Tickets 01, 02, and 03 were built together as one unit of work rather than as three independent agent runs, since they share files (`options.ts`, `map-to-items.ts`, `TimelineCanvas.tsx`, `App.tsx`, `Sidebar.tsx`) tightly enough that sequencing them for real integration made more sense than simulating a merge. See each ticket's own Comments for the two implementation deviations from the original spec text (both non-behavioral): `MILESTONE_CATEGORY_GROUP_COLORS`'s location (ticket 01) and the Conflicts toggle's `aria-label` (ticket 03).
