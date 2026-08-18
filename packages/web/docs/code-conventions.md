# packages/web — Conventions

<!-- Frontend code patterns. Read before implementing features. -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. D3's DOM manipulation is client-only — never assume it can server-render.
- Filter/selection state lives in the feature slice it belongs to; no global state folder.

### Styling

- CSS Modules only; one base/reset file is the sole global stylesheet.
- No hardcoded hex — color/typography/radius come from tokens (`docs/design-tokens.md`) as CSS custom properties. Prefer to use CSS variables.
- Occupation category colors are the single source of truth across People-lane lines, Events-lane marker borders, and the matching filter chip — one palette, never per-surface copies.
- Shape, not color, carries Period vs. PointInTime, the same rule across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Person vs. event is instead carried by lane, label position, and palette — never by color alone.

### Timeline Rendering (D3)

- All D3 rendering config for the three lanes is scoped to `widgets/timeline-canvas/` — layout/scale config, item-mapping, and per-lane rendering are kept as separate concerns within that widget, not spread elsewhere.
- Years are plain numbers end-to-end for positioning — BCE negative, astronomical numbering (year 0 is 1 BCE) — positioning logic never touches a month. Every year shown to the user must go through the shared BCE/CE display formatter — never a raw number, never a duplicated BCE/CE check at the call site.
- Date precision can include a month, but month is only ever surfaced in tooltips, never used for positioning.
- The three lanes share one horizontal-scroll container; that container's native scroll position *is* the time-axis sync across lanes — there's deliberately no cross-lane scroll listener or reentrancy guard. Each lane manages its own vertical row-overflow independently.
- Zoom is one shared scale/state across all three lanes (they must stay in lockstep), clamped to a fixed min/max year-span.
- **Sidebar fame-score filters gate entity density manually — zoom controls only the time-scale**, not which entities render (`packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`). Filtering is client-side against the data-pipeline's already-broad output — no re-ranking.
- **The Year Axis is deliberately plain HTML/CSS, not SVG/D3** like the rest of the widget — a per-tick-DOM-node approach was previously most of initial-load LCP, so don't reintroduce one. Decade labels are windowed to the visible scroll range and omitted below a minimum on-screen spacing to avoid collision at low zoom.
- **Century marks are one ink motif drawn three times** — a lifted, bordered tab in the Year Axis label row, the axis's own bold century tick, and a 1px seam running through both lanes (and the translucent ruler bar itself) — all sharing `--color-border-emphasis`, including the Minimap's own century-strip tick. Century labels are static like every other label (no pin-to-viewport-edge behavior) — jumping to a period stays the Minimap's job.
- Conflicts and Milestones render directly off pre-split, lane-scoped data from the data-pipeline — no client-side category filtering to route entries between lanes.
- Colliding items in every lane are row-stacked using one shared greedy interval-stacking algorithm, sized in pixel-space rather than year-space, since on-screen label width isn't proportional to underlying date range. A row is a **static per-item identity** — computed once against the full dataset at a fixed reference scale, never the live zoom or the currently-filtered set — that each lane then compacts down to whatever it's actually rendering, so an item's row never changes just because of a filter or zoom change (`packages/web/docs/adr/0007-static-row-assignment-replaces-live-per-render-packing.md`).
- Each lane's D3 join keys off literal marker classes, never CSS-Module classes — CSS Modules are styling-only and must never be used as D3 join selectors. A marker class can be shared across lanes, so code querying it (including tests) must scope to the owning lane's `<svg>`, not assume one per page.
- There are no native SVG tooltips — a click-to-open detail drawer replaces them entirely. Entity lookup happens at click time against the already-in-memory dataset, not precomputed per rendered item.
- Wheel-zoom is deliberately not wired; the +/- buttons are the only zoom control. Mouse-drag panning is gated to mouse pointers specifically, so touch keeps native swipe-to-scroll.

### Data and Storage

- Filter/selection/viewport state is in-memory only, owned by its feature slice.

### File Organization

- Organized by mini-FSD layer under `src/`. Cross-widget state (fame-score filter values, selected-entity reference) is lifted to `app/` and threaded down as props; every other feature owns and calls its own state hook internally.
