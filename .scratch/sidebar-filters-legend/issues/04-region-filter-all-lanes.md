# 04 — Region filter across all three lanes

**What to build:** A new, single shared Region filter control (6 geographic toggle pills: Europe, East Asia, South Asia, Middle East, Africa, Americas) that narrows People, Conflicts, and Milestones together — one control, not one per lane. Multiple regions can be active at once (an entity matching any active region stays visible); with no regions active, every lane is unfiltered by region. Combines with AND against the fame-score floor and, for People, the Occupation Domain filter.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A new Region pill row renders in the sidebar, styled as plain neutral toggle chips (no color-coding).
- [ ] Selecting zero regions shows every lane unfiltered by region.
- [ ] Selecting one or more regions shows only entities tagged with at least one selected region (OR across selections).
- [ ] Conflicts and Milestones filter directly on their existing native region tags.
- [ ] People filter via a complete mapping from their 22-value sub-region tags up to the 6 region values — every sub-region resolves to exactly one region value, none excluded from every pill. (See the spec's `UN_REGION_TO_REGION` table, including its two documented best-fit calls: Central Asia → Middle East, Oceania → East Asia.)
- [ ] An entity with no region tags at all (e.g. a Conflict/Milestone with an empty `regionTags`) is excluded whenever any region filter is active.
- [ ] The region filter combines via AND with the fame-score floor and (for People) the Occupation Domain filter.
- [ ] New pure function (alongside `filterByFameScore`) is unit tested: empty selection unchanged, OR semantics, empty-`regionTags` items excluded once a filter is active.
- [ ] The `UN_REGION_TO_REGION` mapping table is unit tested for full coverage — every one of the 22 sub-region values is asserted to resolve to its documented region.
- [ ] New Sidebar UI is component-tested (RTL): renders pills reflecting given active regions, clicking a pill fires the right callback.
- [ ] Selecting regions resets on page reload (session-only state, no persistence).
- [ ] `packages/web` typecheck, lint, and test suite pass.
