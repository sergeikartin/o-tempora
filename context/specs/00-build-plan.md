# Build Order

Units follow the rules agreed in planning: each produces one visible result, stays within one system boundary, introduces dependencies just in time, and merges units that have no standalone visible result or that always ship together.

Data pipeline comes first, deliberately — it has no dependency on the frontend, and building it first means the frontend can be built once against real data instead of fixtures that get swapped out later.

## 1. Data pipeline — scaffold + Fetch

Builds: `/data-pipeline` project (`package.json`, `tsconfig.json`, `fetch/`, `transform/`, `output/`, `data/raw/`), SPARQL queries against the Wikidata Query Service for candidate people and events, raw results validated (structural check on the SPARQL JSON shape, per Invariant in `code-standards.md`) and written to `/data-pipeline/data/raw/`.

Visible result: real, inspectable raw JSON on disk from a live Wikidata query.

Dependencies: none.

## 2. Data pipeline — Score, Tag, Output

Builds: fame score computed from sitelink counts, occupation/region tag mapping (raw Wikidata claims → the app's fixed category sets), final `people.json` / `events.json` written to `/data-pipeline/output/` and copied to `/src/shared/data/`.

Visible result: a complete, schema-correct real dataset — the actual top-N people and events the app will ship with.

Dependencies: Unit 1.

## 3. Project scaffold (frontend)

Builds: Vite + React + TypeScript init, the mini-FSD folder skeleton (`shared/`, `features/`, `widgets/`, `app/`, each with a placeholder `index.ts`), Steiger + `@feature-sliced/steiger-plugin` config, TypeScript strict mode, ESLint.

Visible result: a blank app that runs in the browser and passes lint/type/boundary checks.

Dependencies: none.

## 4. Render timeline with real data

Builds: `shared/types` (`Person`, `HistoricalEvent`), `shared/lib/dates.ts` (`Temporal.PlainDate` + the one `toLegacyDate()` adapter), install `temporal-polyfill` and `vis-timeline`, `widgets/timeline-canvas`, mounted from `app/` — pointed at Unit 2's real dataset from the start.

Visible result: a real pannable/zoomable timeline on screen, two lanes, bounded 10–250yr zoom, default 1800s/100yr view, populated with actual history — no placeholder-then-swap step needed, since real data already exists by this point.

Dependencies: Units 2, 3.

## 5. Apply visual design tokens

Builds: `ui-context.md`'s tokens as CSS custom properties, applied to the timeline — People bars get solid occupation-category fills, Events markers get category-colored borders on cream.

Visible result: the timeline looks like the intended design instead of vis-timeline's defaults.

Dependencies: Unit 4.

## 6. Entity detail panel

Builds: `features/select-timeline-entity` (click state) + `widgets/detail-panel` (name, dates, description, Wikipedia link), wired to the timeline's click handler.

Visible result: clicking any entry opens a real detail tooltip with real data.

Dependencies: Unit 4.

## 7. Occupation filter

Builds: `features/filter-by-occupation`, `features/filter-timeline-entities` (the intersection logic — first filter, so trivial for now), `widgets/filter-bar`.

Visible result: occupation chips appear; toggling one hides/shows matching-colored entries.

Dependencies: Units 4–5.

## 8. Region filter

Builds: `features/filter-by-region`, extends `filter-timeline-entities` to a real two-way intersection, extends `filter-bar`.

Visible result: region chips appear and further narrow the timeline.

Dependencies: Unit 7.

## 9. Fame-tier selector

Builds: `features/filter-by-fame-tier`, extends `filter-timeline-entities` to the full three-way AND (per Invariant 2 in `architecture.md`), extends `filter-bar`.

Visible result: switching tiers changes how many entries are eligible to render.

Dependencies: Unit 8.