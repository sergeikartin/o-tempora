Type: task
Status: needs-info
Blocked by: 09

Implement the layout chosen in ticket 09. Scope to be sharpened from its `## Answer`; the constraints below hold whichever layout wins.

## Constraints

- The sidebar no longer floats over the canvas; nothing clips under chrome and the axis starts at the canvas edge.
- Detail Level is a visible control whose selected state is unambiguous (today two levels look selected), with the hint from ticket 03.
- Lanes are labelled plainly, with one line each ("Who lived when", "Bars last years. Dots are moments.").
- Filters (Occupation, Conflicts & Milestones groups, Region) keep their current semantics: multi-select, OR within a filter, AND across filters, nothing selected means show all. Active filters are visible and clearable in one tap.
- Phone (360–390 px, both orientations): labelled controls instead of the bare hamburger, a visible +/− zoom, filters in a bottom sheet or equivalent; the lane with a sparse Conflicts & Milestones lane is not padded with filler.
- About and the language switch remain reachable (Help in ticket 11 becomes their main home).

ADR: `packages/web/docs/adr/` — the new layout, superseding the sidebar-era decisions (mark them `superseded`).
Docs: `packages/web/docs/design-tokens.md`, `packages/web/docs/timeline-rendering.md`, `docs/product-scope.md`, `CONTEXT.md` (sidebar references in **Locale**, **Occupation Domain**, **Milestone Category Group**, **Detail Level**, **Conflict Category**), `packages/web/docs/adr/0008-mobile-layout-…` check.
