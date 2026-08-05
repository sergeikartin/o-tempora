# packages/web — Conventions

<!-- Frontend code patterns. Read before implementing features. Shared conventions: ../../../docs/code-conventions.md -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. D3's DOM manipulation is client-only — never assume it can server-render.
- Filter/selection state lives in the feature slice it belongs to; no global state folder.

### Styling

- CSS Modules only, no global stylesheets beyond one base/reset file.
- No hardcoded hex values — all color/typography/radius come from tokens (`docs/design-tokens.md`), as CSS custom properties. Exception: `widgets/timeline-canvas/`'s D3 rendering core and its lane CSS Modules (`PeopleLane.module.css`, `WarsLane.module.css`, `EventsLane.module.css`, `TimelineCanvas.module.css`) provisionally inline hex pending ticket 05 (see Timeline Rendering below) — everywhere else, hardcoded hex is a real violation.
- Occupation category colors are the single source of truth for People-lane fills, Events-lane marker borders, and the matching filter chip.
- Person vs. event is carried by lane + shape (People's solid bar vs. Wars & Conflicts' thin range line vs. either lane's point dot), never by color — color means occupation category only.

### Timeline Rendering (D3)

- All D3 rendering config lives in `widgets/timeline-canvas/` (`options.ts` for layout constants/colors/the shared `xScale`/zoom math, `map-to-items.ts` for pure `Person`/`War`/`Discovery` → render-item mapping plus the shared row-assignment function, one component per lane: `PeopleLane.tsx`, `WarsLane.tsx`, `EventsLane.tsx`).
- Years are plain numbers end-to-end (BCE negative) — no `Temporal.PlainDate`/legacy-`Date` conversion anywhere in the rendering path; `shared/lib/dates.ts` keeps only `today()` (for the live upper time bound), which still returns `Temporal.PlainDate` since callers just read its `.year`.
- People, Wars & Conflicts, and Events & Inventions are three lane sections stacked vertically inside **one shared-horizontal-scroll container** (`TimelineCanvas.tsx`'s `scrollContainer`) — that container's native scroll position *is* the time-axis sync across all three lanes, no `rangechange`-style listener or reentrancy guard. Each lane section keeps its own independent `overflow-y: auto` region for row overflow (People needs it — 11 rows over 49 people); a lane's wrapper div is given an explicit inline `width` (the shared `xScale`'s `totalWidth`) wider than the scroll container, which is what drives the shared horizontal scrollbar.
- Zoom is a numeric `pixelsPerYear` state in `TimelineCanvas.tsx`, shared by all three lanes since they share one `xScale`; the +/- buttons call `zoomIn`/`zoomOut` from `options.ts`, clamped to the bounds implied by `ZOOM_MIN_YEARS`/`ZOOM_MAX_YEARS` (`shared/config/viewport.ts`) at the container's current width.
- Wars & Conflicts and Events & Inventions render directly off `wars.json` (`War[]`) and `discoveries.json` (`Discovery[]`), each pre-split and lane-scoped by the data-pipeline — `map-to-items.ts` no longer filters by category to route between the two lanes, it just maps each array 1:1. `mapWars` renders a range line when `endYear` is set, a point otherwise (`discoveries.json` rows never carry `endYear`, so `mapDiscoveries` is always points). The People lane's `mapPeople` keys its fill off `person.occupationDomain` (not `person.category`); Wars/Events key off `category` — both provisionally inlined hex (`DOMAIN_COLORS`/`CATEGORY_COLORS` in `options.ts`) pending Unit 5's real CSS custom properties — the lane CSS Modules' own label/background fills (e.g. `PeopleLane.module.css`'s `.name`, `TimelineCanvas.module.css`'s `.scrollContainer` background) are inlined hex for the same reason, tracked under the same ticket 05.
- A person's `reignPeriods` render as a solid stripe along the bottom edge of their own lifespan bar — plain layout math (same `xScale`, same row's `y`), no vis-timeline-style subgroup/stacking trick needed.
- Only People's solid bars carry their label inside/on the bar (white text on the category-colored fill). Wars & Conflicts (both its range line and point dot) and Events & Inventions (point dot) instead carry their label *below* the marker via a vertical stem, with the label's own color matching the item's category color. Every marker in these two lanes sits at the same fixed `MARKER_CENTER_Y` — right at the top of its lane, so a marker's x-position always reads directly against the shared YearAxis above — rather than moving to a vertical band per row like People's bars do; a colliding item instead gets a taller `STEM_HEIGHT`-based stem (one `MARKER_ROW_PITCH` tier per row from `stemBottomForRow`/`labelYForRow`/`markerLaneHeight` in `options.ts`), pushing just its own label further down while its marker stays put.
- `assignRows` (in `map-to-items.ts`) is the shared greedy interval-graph row-stacking function: sort by `startYear`, place in the first row that clears with a gap to spare (`MIN_ROW_GAP_YEARS` by default), else open a new row. People stacks it in year-space on the person's own lifespan. Wars & Conflicts and Events & Inventions both reuse it in pixel-space instead (their own much smaller `MIN_ROW_GAP_PX` gap) to pick each item's stem-length tier — a below-marker label can be far wider on screen than its underlying date range (or, for a point, has no range at all), so the row/tier there is sized off each item's estimated pixel footprint (`options.ts`'s `estimateLabelWidthPx`, unioned with the marker's own width), not its years.
- Each lane's D3 join uses literal (non-CSS-Module) marker classes like `d3-bar`/`d3-line`/`d3-dot`/`d3-name` for `selectAll`/`data`/`join` matching — CSS-Module classes ride alongside purely for styling and must never be used as join selectors.
- Tooltips render as a native SVG `<title>` child element (real DOM, hover-triggered by the browser), not a component-level `title` attribute.
- Wheel-zoom is not wired; the dedicated +/- buttons are the only zoom control. Native browser scroll (drag-to-scroll aside) handles both panning (horizontal, on the shared container) and per-lane row overflow (vertical, on each lane).

### Data and Storage

- Filter/selection/viewport state is in-memory only, owned by its feature slice.

### File Organization

`src/`, by mini-FSD layer: `shared/lib` (`today()`, the one live `Temporal.PlainDate` read the rendering path needs), `shared/config` (zoom/viewport constants), `shared/types` (re-exports from `packages/shared-types`), `shared/ui` (generic primitives); `features/filter-by-fame-tier`, `features/filter-by-occupation`, `features/filter-by-region`, `features/select-timeline-entity`, `features/filter-timeline-entities` (combines the three filters via AND); `widgets/timeline-canvas`, `widgets/filter-bar`, `widgets/detail-panel`; `app/` (entry point, composes the three widgets).
