# packages/web — Patterns

<!-- Frontend code and design patterns. Read before implementing features or touching styling. Shared conventions: ../../CLAUDE-patterns.md -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. vis-timeline is client-only — never assume it can server-render.
- Filter/selection state lives in the feature slice it belongs to; no global state folder.

### Styling

- CSS Modules only, no global stylesheets beyond one base/reset file.
- No hardcoded hex values — all color/typography/radius come from the tokens below, as CSS custom properties.
- Occupation category colors are the single source of truth for People-lane fills, Events-lane marker borders, and the matching filter chip.
- Person vs. event is carried by lane + shape (bar vs. point), never by color — color means occupation category only.

### Timeline Rendering (vis-timeline)

- All vis-timeline config lives in `widgets/timeline-canvas/`.
- `Temporal.PlainDate` is canonical everywhere; the **only** place allowed to construct a legacy `Date` is `toLegacyDate()` in `shared/lib/dates.ts`, called only from `widgets/timeline-canvas/`. BCE years are negative years, end-to-end.
- People, Wars & Conflicts, and Events & Inventions are **three separate, synced `Timeline` instances** (not one instance with three groups) — a single instance can't give each lane an independent scroll region. Kept in sync via a `rangechange` listener plus a shared reentrancy guard.
- **Superseded, not yet updated in code**: this pattern described `HistoricalEvent.category === "invention"` routing to Events & Inventions, everything else to Wars & Conflicts (range bar if `endDate` is set, else a point). The data-pipeline now produces separate `wars.json` (`War[]`, `endYear`) and `discoveries.json` (`Discovery[]`, no end field) files, so this routing/rendering logic needs updating once `packages/web` consumes them directly — tracked in root `CLAUDE-activeContext.md`'s Open Questions.
- A person's `reignPeriods` render as overlay ranges inside their own lifespan bar, sharing a vis-timeline `subgroup` — real overlap (not stacking) requires the group-level `subgroupStack` config, not `TimelineOptions.stackSubgroups` (a non-obvious trap: the latter only gates whether the former is honored).
- `DataItem.title` renders as vis-timeline's own hover popup, not a static `title` attribute — it isn't in the DOM until actual hover.
- Wheel-zoom is disabled in favor of dedicated +/- buttons; the freed wheel gesture scrolls a lane vertically or pans horizontally instead.

### Data and Storage

- Filter/selection/viewport state is in-memory only, owned by its feature slice.

### File Organization

`src/`, by mini-FSD layer: `shared/lib` (date conversion plus the one legacy-`Date` adapter), `shared/config` (zoom/viewport constants), `shared/types` (re-exports from `packages/shared-types`), `shared/ui` (generic primitives); `features/filter-by-fame-tier`, `features/filter-by-occupation`, `features/filter-by-region`, `features/select-timeline-entity`, `features/filter-timeline-entities` (combines the three filters via AND); `widgets/timeline-canvas`, `widgets/filter-bar`, `widgets/detail-panel`; `app/` (entry point, composes the three widgets).

---

## UI Context

**Design concept:** warm, paper-like page with pastel colors distinguishing entries (set by reference image `greece-view.png`). Color encodes **occupation category**, not person-vs-event — person vs. event is carried by lane and shape instead. Filter chips and timeline entries share the same category color end-to-end.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F3EEDD` | Page background |
| `color-bg-surface` | `#FBF8F0` | Filter bar, sidebar, event point-markers |
| `color-bg-surface-raised` | `#FFFFFF` | Detail/tooltip panel |
| `color-border-subtle` | `#DED3B8` | Default borders, dividers |
| `color-border-strong` | `#C9B98F` | Hover/active borders |
| `color-text-primary` | `#2E2B22` | Primary text |
| `color-text-secondary` | `#83795F` | Secondary/muted text |
| `color-text-on-category` | `#FBF8F0` | Text on a solid category-colored bar |
| `color-accent-selected` | `#B8842E` | Selected entity, viewport indicator, focus ring |
| `color-focus-ring` | `#8C5A1E` | Keyboard focus outline |

### Occupation Category Palette

Used as a solid fill (People-lane bars) or a colored border on white/cream (Events-lane markers).

| Category | Token | Hex |
|---|---|---|
| Science | `color-category-science` | `#7FA6C4` |
| Politics | `color-category-politics` | `#D8A34D` |
| Art | `color-category-art` | `#C98A9A` |
| Philosophy | `color-category-philosophy` | `#8CAE8A` |
| War | `color-category-war` | `#B06156` |
| Invention | `color-category-invention` | `#6FA8A0` |
| Exploration | `color-category-exploration` | `#D08A54` |
| Religion | `color-category-religion` | `#A891C4` |

No occupation tag / uncategorized → `color-border-subtle` as a neutral fallback, not a ninth pastel.

### Typography

| Role | Typeface |
|---|---|
| Display | Fraunces (serif, variable) — app title only |
| Body / UI | Inter — all UI chrome and entry labels |
| Data / Dates | IBM Plex Mono — year ranges and dates (tabular figures) |

### Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-full` | `9999px` | Filter chips |
| `radius-sm` | `6px` | Event point-markers |
| `radius-md` | `8px` | People-lane range bars |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
