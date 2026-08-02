# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or module.
- Respect the system boundaries defined in `architecture.md`.
- The frontend (`/src`) and the data pipeline (`/data-pipeline`) are separate projects. Neither imports code from the other — they communicate only through the generated JSON files.
- FSD layer and public-API boundaries (see React section below) are enforced by [Steiger](https://github.com/feature-sliced/steiger) with the `@feature-sliced/steiger-plugin` ruleset, run in CI on every PR. A violation fails the build — it is not a style suggestion. Steiger's rules support omitting the `entities` and `pages` layers (this project uses a 4-layer `shared → features → widgets → app` chain), so no rule-disabling is needed for the reduced structure.

## TypeScript

- Strict mode is required throughout the project, in both `/src` and `/data-pipeline`.
- Avoid `any`; use explicit interfaces or narrowly scoped types.
- Validate unknown external input at system boundaries before trusting it — this applies specifically to raw Wikidata query results in the pipeline's Fetch stage, which must be validated before Transform touches them.
- Use `interface` for object contracts (e.g. `Person`, `HistoricalEvent`), and share those types between `/src` and `/data-pipeline` rather than redefining them in both places.
- Use `Temporal.PlainDate` (from the `Temporal` global, polyfilled) for all date values in application and pipeline code — never construct or pass around legacy `Date` objects except at the one documented adapter boundary (see Timeline Rendering below). `Temporal.PlainDate` supports negative (BCE) years natively as part of its ISO calendar, so there's no need for the "literal negative-year" workaround the prototype used with `Date`.

## React (mini-FSD)

- The frontend uses a scaled-down Feature-Sliced Design: layers are `shared → features → widgets → app`. `entities` and `pages` are deliberately omitted — this is a single-domain, single-page app, and FSD itself treats both layers as optional when they don't earn their keep. A layer may only import from layers *below* it — never sideways within the same layer, and never upward.
- Person and event types live in `shared/types/` rather than a dedicated `entities` layer, since there's no independent entity-level UI or logic beyond the raw data contract.
- Each slice (a folder inside `features/` or `widgets/`) exposes a single public entry point (`index.ts`). Other code imports from that entry point, never by reaching into a slice's internal files directly.
- Functional components only.
- vis-timeline is a client-only, DOM-manipulating library. Do not attempt to server-render it or assume it can run outside a browser environment.
- Filter state and selection state are owned by the feature slice they belong to (`features/filter-by-fame-tier`, `features/select-timeline-entity`, etc.) — there is no global state folder that every component reaches into.
- Business logic (filter intersection, date conversion) lives in the layer it belongs to, never inline in a widget or component.
- If the app later grows a second page or genuinely independent entity-level logic, `pages` or `entities` can be reintroduced as a deliberate decision — not preemptively.

## Styling

- Use CSS Modules, scoped per component — no global stylesheets beyond a single base/reset file.
- No hardcoded hex values or ad hoc colors in component files. All color, typography, and radius values come from the tokens defined in `ui-context.md`, expressed as CSS custom properties (e.g. `var(--color-bg-base)`, `var(--color-category-science)`, `var(--radius-md)`) — never a raw hex or pixel value inline.
- Occupation category colors (`color-category-*` in `ui-context.md`) are the single source of truth for both People-lane bar fills and Events-lane marker borders, and for the matching occupation filter chip. If a component needs "the color for this occupation," it looks it up from that shared token set — it does not maintain its own copy of the category-to-color mapping.
- Person-vs-event distinction is carried by lane and shape (range bar vs. point marker), never by color — color is reserved for occupation category and the small set of UI-state tokens (`color-accent-selected`, `color-focus-ring`). Don't repurpose a category color to also mean "selected" or "hovered."
- Keep spacing and radius values consistent across components rather than picking arbitrary pixel values per component; use the `radius-*` scale from `ui-context.md`.

## Timeline Rendering (vis-timeline)

- All vis-timeline configuration (zoom bounds, groups, stacking options) lives inside `widgets/timeline-canvas/`, not spread across multiple files.
- `Temporal.PlainDate` is the canonical date type everywhere in the app — but vis-timeline's standalone build bundles moment.js internally and only understands legacy `Date` objects. It has no concept of `Temporal`. So `widgets/timeline-canvas/` is the **only** place allowed to convert a `Temporal.PlainDate` into a legacy `Date`, via a single adapter function (`toLegacyDate()` in `shared/lib/dates.ts`), exactly at the point where an item is handed to the vis-timeline `DataSet`. No other file constructs a `Date` for any reason.
- BCE years are represented as negative years in `Temporal.PlainDate` end-to-end (pipeline output through rendering); the adapter is the only place sign conventions get translated into `Date`'s own (differently-behaved) negative-year handling.
- Entries with only year-level precision (most of ancient and medieval history) are represented as `Temporal.PlainDate(year, 1, 1)` — month/day are a placeholder, not a real claim about the date, and should be treated as such anywhere they're displayed.
- The People and Events groups are defined once inside `widgets/timeline-canvas/` and referenced by id, not redefined per render.
- No direct DOM manipulation outside `widgets/timeline-canvas/` — vis-timeline already owns the DOM inside its container; don't reach into it from sibling widgets or pages.
- `widgets/timeline-canvas/` is the only place allowed to import from both `shared/types` (person, event data contracts) and `features/` (the combined filter selector) at once — that's what makes it a widget rather than a feature.

## Data and Storage

- There is no database and no backend service. `packages/shared-types/src/data/*.json` (imported directly, not copied into `/src`) is the only data the running app reads.
- `packages/shared-types/src/data/*.json` is always machine-generated by the pipeline's Output stage — never hand-edited. There is no override mechanism in v1; a correction means fixing the pipeline's Score or Tag logic and regenerating.
- Keep dataset entries limited to the fields the app actually renders (name, dates, tags, fame score, short description, Wikipedia URL) — do not store long-form content, embeds, or anything the tooltip doesn't display.
- Filter state, selected-entity state, and viewport state are in-memory only, owned by their feature slice. Do not introduce `localStorage`/`sessionStorage` without treating it as a scope change, not a bug fix.

## Data Pipeline

- The Fetch stage never merges, scores, or tags data — it only writes raw Wikidata query results to `/data-pipeline/data/raw/`, untouched.
- Fame score is computed from sitelink count only, in the Score stage. Do not blend in other signals (page views, manual weighting) without an explicit decision to change the ranking model.
- Occupation and region tagging happens in Transform, as an explicit, readable lookup table — not inferred ad hoc or duplicated across scripts.
- There is no manual override mechanism in v1 — corrections to fame ranking or tagging are made by fixing Score/Tag logic and re-running the pipeline, not by hand-editing output or adding patch files. If this becomes a real bottleneck, an override mechanism should be added as a deliberate decision, not grown ad hoc.
- The pipeline must be runnable end-to-end from a clean checkout and produce the same output given the same raw snapshots.

## File Organization

Frontend (`src/`), organized by mini-FSD layer, lowest to highest (`shared → features → widgets → app`):

- `shared/lib/` — generic, business-agnostic logic: `dates.ts` (parsing/formatting on `Temporal.PlainDate`, BCE handling, plus the one `toLegacyDate()` adapter used only by `widgets/timeline-canvas/`).
- `shared/config/` — constants: zoom bounds (10–250 year window), default viewport (1800s, 100-year window).
- `shared/types/` — re-exports the `Person`, `HistoricalEvent`, `Category`, and `Region` types from `packages/shared-types` (the canonical definitions, shared with `/data-pipeline` via an npm workspace — see `architecture.md`'s Stack table and System Boundaries section). Not a full entities layer.
- No `shared/data/` folder: the generated `people.json`/`events.json` datasets live in `packages/shared-types/src/data/` and are imported directly from there — not copied into `/src`, to avoid keeping two copies in sync.
- `shared/ui/` — generic, reusable UI primitives with no business meaning (e.g. a base `Chip` component).
- `features/filter-by-fame-tier/` — fame tier selector: its own state and UI.
- `features/filter-by-occupation/` — occupation chip filter: its own state and UI.
- `features/filter-by-region/` — region chip filter: its own state and UI.
- `features/select-timeline-entity/` — click-to-select state (which entity, if any, is open in the detail panel).
- `features/filter-timeline-entities/` — reads the three filter features' state and applies the fame-tier AND occupation AND region intersection (see Invariant 2 in `architecture.md`); exposes the resulting visible-entities list to widgets.
- `widgets/timeline-canvas/` — the vis-timeline wrapper; consumes `shared/types` data filtered through `features/filter-timeline-entities`, owns pan/zoom bounds and group configuration.
- `widgets/filter-bar/` — composes the three filter features into one UI bar.
- `widgets/detail-panel/` — composes `features/select-timeline-entity` with entity data to render the click-triggered tooltip.
- `app/` — entry point, global providers, global styles; composes the three widgets directly into the full-screen layout (no separate `pages` layer, since this is a one-screen app).

Data pipeline (`data-pipeline/`), unaffected by mini-FSD — it's a separate, non-UI project:

- `data-pipeline/fetch/` — raw Wikidata queries only.
- `data-pipeline/transform/` — grouping, scoring, and tagging logic:
  - `group-rows.ts` — collapses denormalized SPARQL rows into one record per entity; config-driven, shared by all three raw sources. Covered by a `group-rows.test.ts` fixture test, run via Node's built-in `node:test` runner (`npm test`) rather than Vitest, since Vitest is declared in `architecture.md`'s Stack table for the frontend only.
  - `occupation-categories.ts`, `region-categories.ts`, `event-type-categories.ts` — explicit Wikidata Q-ID → app category/region lookup tables.
  - `list-unmapped-occupations.ts`, `list-unmapped-countries.ts` — helper scripts that dump any Q-ID present in the raw data but missing from the lookup tables above; re-run after each batch of manual table additions.
  - `tag-people.ts`, `tag-events.ts` — apply the lookup tables to grouped rows, producing primary category + tag array (people) or category (events) + region tags.
  - `score.ts` — sorts by fame score (sitelink count) descending and slices to the fame-tier ceiling (750).
  - `index.ts` — orchestrates group → tag → score for both the people and events lanes.
- `data-pipeline/output/` — final JSON generation:
  - `write-datasets.ts` — constructs the final `Person`/`HistoricalEvent` shape from transform's output, applies the drop rules (missing name, Wikipedia article, description, or required date), and reports what was dropped and why.
  - `index.ts` — runs the full transform → output flow (`npm run build-data`) and writes `people.json`/`events.json` directly into `packages/shared-types/src/data/` — a single copy, not a `data-pipeline/output/` copy plus a duplicate under `src/shared/data/`.
- `packages/shared-types/` — the canonical `Person`/`HistoricalEvent`/`Category`/`Region` type contracts, imported by `/data-pipeline` (and, from Unit 3/4, by `/src/shared/types/`) via an npm workspace. `packages/shared-types/src/data/` holds the pipeline's generated `people.json`/`events.json`, imported directly by `/src` (no `src/shared/data/` copy). Not itself part of either the frontend's mini-FSD layering or the pipeline's stage structure — see `architecture.md`'s Stack table and System Boundaries section.

Name files after the responsibility they contain, not the technology.