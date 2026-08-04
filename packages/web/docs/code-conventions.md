# packages/web — Conventions

<!-- Frontend code patterns. Read before implementing features. Shared conventions: ../../../docs/code-conventions.md -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. vis-timeline is client-only — never assume it can server-render.
- Filter/selection state lives in the feature slice it belongs to; no global state folder.

### Styling

- CSS Modules only, no global stylesheets beyond one base/reset file.
- No hardcoded hex values — all color/typography/radius come from tokens (`docs/design-tokens.md`), as CSS custom properties.
- Occupation category colors are the single source of truth for People-lane fills, Events-lane marker borders, and the matching filter chip.
- Person vs. event is carried by lane + shape (bar vs. point), never by color — color means occupation category only.

### Timeline Rendering (vis-timeline)

- All vis-timeline config lives in `widgets/timeline-canvas/`.
- `Temporal.PlainDate` is canonical everywhere; the **only** place allowed to construct a legacy `Date` is `toLegacyDate()` in `shared/lib/dates.ts`, called only from `widgets/timeline-canvas/`. BCE years are negative years, end-to-end.
- People, Wars & Conflicts, and Events & Inventions are **three separate, synced `Timeline` instances** (not one instance with three groups) — a single instance can't give each lane an independent scroll region. Kept in sync via a `rangechange` listener plus a shared reentrancy guard.
- Wars & Conflicts and Events & Inventions render directly off `wars.json` (`War[]`) and `discoveries.json` (`Discovery[]`), each pre-split and lane-scoped by the data-pipeline — `map-to-items.ts` no longer filters by category to route between the two lanes, it just maps each array 1:1. `mapWarsAndConflictsToItems` renders a range bar when `endYear` is set, a point otherwise (`discoveries.json` rows never carry `endYear`, so that lane is always points). The People lane's `mapPeopleToItems` uses `person.occupationDomain` (not `person.category`) for its `category-*` className — still unstyled either way, pending Unit 5.
- A person's `reignPeriods` render as overlay ranges inside their own lifespan bar, sharing a vis-timeline `subgroup` — real overlap (not stacking) requires the group-level `subgroupStack` config, not `TimelineOptions.stackSubgroups` (a non-obvious trap: the latter only gates whether the former is honored).
- `DataItem.title` renders as vis-timeline's own hover popup, not a static `title` attribute — it isn't in the DOM until actual hover.
- Wheel-zoom is disabled in favor of dedicated +/- buttons; the freed wheel gesture scrolls a lane vertically or pans horizontally instead.

### Data and Storage

- Filter/selection/viewport state is in-memory only, owned by its feature slice.

### File Organization

`src/`, by mini-FSD layer: `shared/lib` (date conversion plus the one legacy-`Date` adapter), `shared/config` (zoom/viewport constants), `shared/types` (re-exports from `packages/shared-types`), `shared/ui` (generic primitives); `features/filter-by-fame-tier`, `features/filter-by-occupation`, `features/filter-by-region`, `features/select-timeline-entity`, `features/filter-timeline-entities` (combines the three filters via AND); `widgets/timeline-canvas`, `widgets/filter-bar`, `widgets/detail-panel`; `app/` (entry point, composes the three widgets).
