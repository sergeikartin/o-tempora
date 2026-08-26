# 01 — Extract pure layout builders and a shared mark-shape descriptor

**What to build:** A prefactor for [[03-build-time-prerender-of-the-default-viewport]] and [[02-d3-join-adoption-logic]] — no visible or behavioral change on its own. `widgets/timeline-canvas/map-to-items.ts` gains two new exported pure functions, `buildPersonLayout(people, xScale, personRowFor)` and `buildRangeAndPointLayout(conflicts, milestones, xScale, eventsRowFor)`, moved out of `PeopleLane.tsx`'s and `ConflictsMilestonesLane.tsx`'s inline `useMemo` bodies (the `PersonLayout`/`RangeLayout`/`PointLayout` types move here too). Both lanes' `useMemo`s become thin wrappers around these, same dependency arrays, same memoization boundaries.

A new `widgets/timeline-canvas/mark-shape.ts` (not exported from the slice's public `index.ts`) declares the exact DOM shape of each of the three mark kinds' 5 children as data — `PERSON_MARK_SHAPE`, `RANGE_MARK_SHAPE`, `POINT_MARK_SHAPE` (element tag, literal `d3-*` class, the CSS-Module `styles` key, and any attrs fixed at creation time: `stroke-width`, `stroke-linecap`, `r`, `text-anchor`, `dominant-baseline`) — plus `MARK_ID_SELECTOR = '.d3-hit'`. `PeopleLane.tsx`'s and `ConflictsMilestonesLane.tsx`'s `enter` branches are refactored to build their nodes by iterating the matching descriptor instead of the current hand-written `.append()`/`.attr()` chain. The `update`-selection logic (data-bound attrs, transitions) is untouched.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `map-to-items.ts` exports `buildPersonLayout` and `buildRangeAndPointLayout`; `PersonLayout`/`RangeLayout`/`PointLayout` types live there.
- [ ] `PeopleLane.tsx`'s and `ConflictsMilestonesLane.tsx`'s layout `useMemo`s call the new exports instead of computing layout inline — no change to their dependency arrays or memoization behavior.
- [ ] `mark-shape.ts` exists with `PERSON_MARK_SHAPE`, `RANGE_MARK_SHAPE`, `POINT_MARK_SHAPE`, and `MARK_ID_SELECTOR`, each descriptor covering all 5 children in the exact DOM order the current `enter` branches produce (rect hit, ring-outer, ring-gap, main line/dot, name wrapper — point marks flag `supportsTspans: true` for the wrapped-label case).
- [ ] `PeopleLane.tsx`'s and `ConflictsMilestonesLane.tsx`'s `enter` branches build nodes from the matching descriptor array rather than a hand-written chain.
- [ ] `PeopleLane.test.tsx` and `ConflictsMilestonesLane.test.tsx` pass unchanged — the refactor produces byte-identical DOM structure to before (verify by running the existing suite, not by relaxing assertions).
- [ ] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint:boundaries --workspace packages/web` all pass.
