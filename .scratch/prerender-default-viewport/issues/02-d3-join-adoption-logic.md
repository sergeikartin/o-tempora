# 02 — D3 join adoption logic for pre-existing mark nodes

**What to build:** Teach both lanes' D3 joins to recognize mark elements that are already in the DOM but unbound (no `__data__`) — the situation a prerendered page will be in before hydration's first `useLayoutEffect` pass — and treat them as an `update` rather than destroying and recreating them as a fresh `enter`. This ticket is independently verifiable without the real build step existing yet: a test hand-injects a fixture `<g class="d3-person">…</g>` (or the ranges/points equivalent) fragment via `container.innerHTML` before `render()`, matching the shape [[01-shared-mark-shape-descriptor]] produces, and asserts adoption.

`mark-shape.ts` gains `seedPrerenderedData<T extends { id: string }>(selection, layout: T[])`: for each node in `selection` whose `__data__` is `undefined`, it reads `data-entity-id` off the node's `MARK_ID_SELECTOR` child and looks up the matching layout item, seeding `__data__` via `.property('__data__', ...)` before the keyed join runs. Once a real join has run once, every node has non-`undefined` `__data__`, so this is a no-op on every subsequent effect run — no first-run flag needed.

Each lane's join call is restructured to select existing nodes, call `seedPrerenderedData`, then run `.data(layout, (d) => d.id).join(...)` against that same selection — applied to `g.people > g.d3-person` in `PeopleLane.tsx`, and to both `g.ranges > g.d3-range` and `g.points > g.d3-point-group` in `ConflictsMilestonesLane.tsx`. No other change to either lane's `enter`/`update`/`exit` branches.

**Blocked by:** 01 (needs `mark-shape.ts`'s `MARK_ID_SELECTOR` and the refactored `enter` branches from that ticket to attach adoption to).

**Status:** done

- [x] `mark-shape.ts` exports `seedPrerenderedData`, self-limiting by construction (a no-op once every node already has bound data).
- [x] `PeopleLane.tsx`'s join and both of `ConflictsMilestonesLane.tsx`'s joins (ranges, points) call `seedPrerenderedData` on the existing selection before `.data(layout, keyFn).join(...)`.
- [x] New test in `PeopleLane.test.tsx`: inject an unbound fixture `.d3-person` fragment (carrying `data-entity-id` matching a fixture person) into the container before `render()`; after render, assert the *same* DOM node is still present (not a replacement — e.g. tag it with a marker attribute/property before render and check it survived), its data-bound attributes match the fixture's real computed values, and no fade-in (`opacity` transition / enter styling) was ever applied to it.
- [x] Equivalent new tests in `ConflictsMilestonesLane.test.tsx` for both the range and point adoption paths.
- [x] Existing join/enter/exit tests in both files continue to pass unchanged — a normal fresh mount (no pre-existing DOM) still goes through the ordinary `enter` path with its fade-in, exactly as today.
- [x] `npm run typecheck --workspace packages/web` and `npm run test --workspace packages/web` pass.
