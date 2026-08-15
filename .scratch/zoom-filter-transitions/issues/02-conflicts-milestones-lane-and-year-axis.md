# 02 — Extend zoom animation to Conflicts+Milestones lane and the Year Axis/gridlines

**What to build:** Apply ticket 01's proven transform/counter-scale mechanism to the two remaining zoom-scaled surfaces: `ConflictsMilestonesLane` and the Year Axis/gridlines (a CSS `repeating-linear-gradient` DOM background, not SVG). All three must animate in sync — the axis and gridlines snapping while marks glide would visibly misalign decade lines against moving dots/lines.

**Blocked by:** 01

**Status:** done

- [x] `ConflictsMilestonesLane` gets the same wrapping-`<g>` `transform` treatment as `PeopleLane` (ticket 01), driven by the same `requestAnimationFrame` loop/tick — one driver updating all animated surfaces per frame, not a separate loop per lane.
- [x] Conflict/Milestone labels and dot markers get the same per-tick counter-scale treatment as People labels/dots.
- [x] The Year Axis and full-height decade gridlines (CSS-gradient-driven, `options.ts`/`YearAxis.tsx`) get equivalent per-tick treatment so they visibly move in sync with the lanes throughout the animation — not just snapping to the final state when the animation ends.
- [x] The interrupt/retarget behavior from ticket 01 (a new click mid-animation cancels and restarts from the current interpolated value) applies uniformly across all three animated surfaces — nothing lags or desyncs from the others when interrupted.
- [x] The deferred state-commit pattern from ticket 01 (real `pixelsPerYear`/`scrollLeft` committed once, at the end, via the DOM-width-driven `useLayoutEffect`) is unchanged — this ticket only adds more surfaces to the per-tick write, not a second commit path.
- [x] `TimelineCanvas.test.tsx` extended: final rendered positions for Conflicts+Milestones marks and Year Axis ticks match the target `pixelsPerYear` after the animation resolves.
- [x] Manually verified in the running dev app that People, Conflicts+Milestones, and the Year Axis/gridlines all move together with no visible lag or misalignment between them during a zoom animation.
- [x] `packages/web` typechecks, lints, and its test suite passes.

## Comments

Implemented as specified — `ConflictsMilestonesLane` and `YearAxis` both expose the same `ZoomAnimationHandle` shape ticket 01 established, driven by TimelineCanvas's single rAF loop. The gridline layer (a plain div, not owned by any Lane/Axis component) is driven directly from TimelineCanvas via a DOM ref rather than an imperative handle, since there's no component boundary to cross there.
