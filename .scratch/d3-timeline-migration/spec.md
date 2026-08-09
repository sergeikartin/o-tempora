# D3 Timeline Migration

## Destination

All three timeline lanes (People, Wars & Conflicts, Events & Inventions) render via D3 inside a single shared-horizontal-scroll container, replacing vis-timeline entirely — `vis-timeline` removed from `packages/web/package.json`. Zoom (currently `Timeline.zoomIn()`/`zoomOut()`) reimplemented under D3.

This is the follow-on execution effort `.scratch/timeline-rendering-foundation/map.md` deliberately left out of scope, now that `packages/web/docs/adr/0001-d3-over-vis-timeline.md` decided D3.

## Starting point

- Decision + rationale: `packages/web/docs/adr/0001-d3-over-vis-timeline.md`.
- Reference implementation: branch `prototype/d3-people-lane-ticket-01` — People lane only, prototype-quality (inlined colors, no zoom, no tests, `PROTOTYPE` markers throughout). This migration productionizes that approach; it does not start from scratch.

## Architecture

Already decided by the ADR's Consequences — not open for re-litigation here:

- One shared-horizontal-scroll container holding all three lanes stacked vertically, in order: People, Wars & Conflicts, Events & Inventions. One shared scroll position *is* the time-axis sync — no `rangechange` listener or reentrancy guard.
- Each lane keeps its own independent vertical scroll region for row overflow (People needs it — 11 rows over 49 people in the prototype; Wars/Events likely won't, at 18/24 items).
- Zoom: a numeric zoom-level (pixels-per-year) state drives a re-render of the shared `xScale`; the existing +/- buttons wire directly to it.

## Scope

**In scope:** `packages/web/src/widgets/timeline-canvas/*` rewrite (`options.ts`, `map-to-items.ts`, `TimelineCanvas.tsx`/`.module.css`, tests); removing the `vis-timeline` dependency; updating `packages/web/docs/code-conventions.md`'s "Timeline Rendering" section and `packages/web/CLAUDE.md`'s Stack table + description line once landed.

**Out of scope:** Unit 5's remaining design-token decisions (exact reign-period marker token, lifespan-bar font-size/padding — see `docs/active-context.md`'s Next Up); Unit 9 (fame-tier selector); data-pipeline/data changes.

## Tickets

See `issues/`.
