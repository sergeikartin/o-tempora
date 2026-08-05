---
status: accepted
---

# D3 as the rendering foundation for all three timeline lanes

## Context

Unit 5 (People-lane lifespan rendering) stalled mid-grilling-session over a vis-timeline limitation: it reserves stacking row-height from its own default item height rather than honoring CSS overrides, which was blocking the People lane's custom bar styling. That surfaced four further pain points already fought while integrating vis-timeline: no clean way to give lifespan bars and reign-period overlays custom height/color, an initial-load stacking-collision bug that overlaps items and hides names, no native-scroll panning (the current implementation drives three separate `Timeline` instances through a custom `rangechange`-listener-plus-reentrancy-guard to keep them in sync), and two separate occasions of having to reverse-engineer undocumented internals to get standard behavior — the `subgroupStack`/`stackSubgroups` trap for reign-period overlap (`options.ts`), and the three-instance sync mechanism itself.

A throwaway D3 prototype of the People lane — the hardest of the three lanes (overlapping ranges, a reign-period overlay, stacking) — was built against real Pantheon data (`.scratch/timeline-rendering-foundation/issues/01-d3-people-lane-prototype.md`) and compared side-by-side against current vis-timeline behavior via a dev-only switcher.

## Decision

`packages/web` moves to D3 as the rendering foundation for all three timeline lanes — People, Wars & Conflicts, and Events & Inventions — replacing vis-timeline entirely. Migration execution is a separate follow-on effort, not part of this decision.

## Why

The prototype resolved every driver behind the original stall, verified with headless-Chrome screenshots against real data (not just typecheck/tests):

- **Custom rendering.** 16px domain-colored lifespan bars and a solid reign-period stripe (replacing vis-timeline's neutral dashed border) both rendered correctly.
- **Stacking-collision bug.** vis-timeline's screenshot reproduced the actual bug — Napoleon's reign-period overlay overlapped and obscured Thomas Jefferson's and Fyodor Dostoevsky's names in the same stacked row. D3's screenshot showed zero overlaps across all 49 real people (11 packed rows), via a greedy interval-graph row assignment (sort by `startYear`, place in the first row that clears with a 5-year buffer, else open a new row).
- **Native-scroll panning.** Confirmed via the browser's own scrollbar over a wide SVG — no custom sync code.
- **Render performance.** Not formally benchmarked — deliberately. All three lanes are tiny (People 49, Wars & Conflicts 18, Events & Inventions 24 items), leaving no scale for a real regression to hide in, so qualitative signal (visibly smoother in side-by-side comparison) plus dependency weight (`d3` 880K vs. `vis-timeline` 75M in `node_modules`, the latter dragging in moment.js/moment-timezone locale data, hammerjs, and vis-data) was judged sufficient.
- **Implementation clarity** (a fifth driver, named during this decision, not in the original four). vis-timeline required fighting undocumented internals twice — the `subgroupStack` trap and the `rangechange`/reentrancy-guard sync. Both problems are structurally absent under D3 (see Consequences).

## Considered Options

**Stay on vis-timeline**, reconfiguring it further to fix the stacking bug and add custom styling. Rejected: the map's standing preference was to decide by prototype rather than research whether vis-timeline could be reconfigured, and the prototype gave no reason to reconsider that framing — every driver had a working D3 fix and none pointed back.

## Consequences

- **The People-lane prototype stands as sufficient evidence for all three lanes**; Wars & Conflicts and Events & Inventions were not separately prototyped. They are a strict subset of what the People lane already proved: plain range/point items, a single flat `category` fill color (no per-item overlay to composite), no subgroup-overlap need, and smaller datasets (18 and 24 items vs. 49).
- **Cross-lane sync architecture changes shape, not just implementation.** The current three-separate-`Timeline`-instances design exists only because vis-timeline gives one instance exactly one shared global vertical scroll region. D3 has no such limit: migration should collapse to a single shared-horizontal-scroll container holding all three lanes stacked vertically in their current order (People, then Wars & Conflicts, then Events & Inventions), each free to have its own independent vertical scroll region for row overflow. One shared scroll position *is* the sync — the `rangechange` listener and reentrancy guard in `TimelineCanvas.tsx` go away entirely, they're not ported.
- **Zoom is unresolved by this decision, deliberately.** The +/- buttons currently call vis-timeline's `zoomIn()`/`zoomOut()` directly; that API disappears with vis-timeline. Left for migration execution to implement (e.g., a numeric zoom-level state driving a re-render) — judged low-risk enough not to block this decision either way.
- Migration touches `options.ts`, `map-to-items.ts`, `TimelineCanvas.tsx`/`.module.css`, and their tests; `vis-timeline` is removed from `packages/web/package.json` once it lands.
