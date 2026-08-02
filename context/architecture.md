# Architecture: World History Timeline

This describes the technical architecture for the v1 scope defined in `project-overview.md`. The project has two parts: a **frontend app** — a read-only, client-side, continuously zoomable timeline of world history built on vis-timeline — and a **data pipeline** that curates the frontend's dataset from Wikidata. They ship independently: the pipeline runs offline to produce static JSON, and the frontend only ever reads that JSON.

**Assumption made here, flag if wrong:** the frontend framework (React + TypeScript + Vite) wasn't explicitly locked down in planning — only the rendering library (vis-timeline) was. I've defaulted to your usual stack since this app has no backend, no auth, and no server-rendering need, which makes Vite a better fit than Next.js (no routes, no SSR requirement, no API layer).

## Stack

| Layer | Technology | Role |
|---|---|---|
| UI framework | React + TypeScript | Component structure organized via Feature-Sliced Design (see `code-standards.md`), type-safe data models |
| Build tool | Vite | Dev server, bundling, static production build |
| Timeline rendering | vis-timeline (standalone build) | Pan/zoom canvas, item stacking, groups (People / Events lanes) |
| Date handling | `Temporal` (via `temporal-polyfill`) | Canonical date type app-wide, including native BCE (negative year) support. Native `Temporal` ships in Chrome 144+/Firefox 139+ but not yet in stable Safari, so the polyfill is a real runtime dependency, not a stopgap. vis-timeline itself still requires legacy `Date` at its own API boundary — see `code-standards.md` for the adapter rule |
| Styling | CSS Modules or plain CSS | Component-scoped styles, no CSS-in-JS runtime needed for a static app |
| Data format | Static JSON (bundled at build time) | People and events datasets, generated offline from Wikidata |
| Pipeline query layer | Wikidata Query Service (SPARQL) | Source of truth for candidate people/events, sitelink counts, birth/death dates, occupation and location claims |
| Pipeline scripting | Node.js + TypeScript (same language as the app, separate package) | Fetches SPARQL results, computes fame scores, maps raw Wikidata occupations/locations to the app's fixed tag sets, writes final JSON |
| Pipeline intermediate storage | Local JSON files (not a database) | Raw query snapshots and staged/curated data, checked into the repo for reproducibility and review (see Data Pipeline section) |
| Hosting | Static hosting (e.g., Vercel, Netlify, GitHub Pages) | Serves the built static bundle; no server process required |
| Testing | Vitest + React Testing Library | Unit tests for filter logic, date conversion utilities, and rendering |
| Monorepo tooling | npm workspaces | Roots the repo at a workspace `package.json` (`data-pipeline`, `packages/*`) so `packages/shared-types` — the `Person`/`HistoricalEvent`/`Category`/`Region` type contracts, plus the generated `people.json`/`events.json` datasets under `packages/shared-types/src/data/` — can be imported by both `/data-pipeline` and (from Unit 3/4) `/src` without either project importing the other. Added in Unit 2 to resolve the package-boundary question `code-standards.md`'s "share those types" rule left open; data-pipeline's own pipeline tests use Node's built-in `node:test` runner rather than adding Vitest there, since Vitest is only declared for the frontend above |

There is no backend *service* and no database behind the running app — the shipped product is a static bundle plus static data files. The pipeline never runs at app runtime, and the frontend never talks to Wikidata directly.

## System Boundaries

The repo has two independent top-level projects: `/src` (the frontend app) and `/data-pipeline` (the data pipeline). Neither imports code from the other directly. Instead, both import from `packages/shared-types`, a small internal npm-workspace package with no logic of its own beyond type definitions — it holds the `Person`/`HistoricalEvent`/`Category`/`Region` type contracts (a compile-time-only import) and, under `packages/shared-types/src/data/`, the generated `people.json`/`events.json` datasets themselves (a build-time data import, written once by the pipeline's Output stage and read by the frontend build — see Storage Model). This lets the two projects share both the type definition and the generated data through one neutral package per `code-standards.md`'s "share those types" rule, without `/data-pipeline` and `/src` ever importing from one another directly.

### Frontend (`/src`)

The frontend uses a scaled-down Feature-Sliced Design (mini-FSD): layers are `shared → features → widgets → app`. `entities` and `pages` are deliberately omitted, since this is a single-domain, single-page app — FSD treats both as optional layers. A layer may only import from layers below it. Full layer-by-layer file organization lives in `code-standards.md`; the table below covers the responsibilities that matter architecturally.

| Layer | Owns |
|---|---|
| `/src/shared/` | Business-agnostic logic and constants: date conversion (`lib/dates.ts`), zoom/viewport constants (`config/`), the `Person`/`HistoricalEvent` type contracts (`types/`, re-exported from `packages/shared-types`), generic UI primitives (`ui/`). The generated `people.json`/`events.json` datasets are not duplicated here — the frontend imports them directly from `packages/shared-types/src/data/` (see System Boundaries and Storage Model) |
| `/src/features/` | Independent user-facing behaviors with their own state: fame-tier selection, occupation filter, region filter, entity selection, and the combined filter-intersection logic that decides what's visible |
| `/src/widgets/` | Composite UI blocks that combine `shared/types` data with `features/` behavior: the `timeline-canvas` (vis-timeline wrapper, owns pan/zoom bounds and group config), `filter-bar`, and `detail-panel` |
| `/src/app/` | Entry point, global providers, global styles; composes the three widgets directly into the full-screen layout |

### Data Pipeline (`/data-pipeline`)

| Folder | Owns |
|---|---|
| `/data-pipeline/fetch/` | SPARQL queries against the Wikidata Query Service; writes raw, unmodified query results to `/data-pipeline/data/raw/`. Never computes scores or tags — fetching and transforming are kept separate so a bad transform doesn't require re-querying Wikidata |
| `/data-pipeline/transform/` | Computes fame score from sitelink counts, maps raw Wikidata occupation/location claims onto the app's fixed occupation and region tag sets |
| `/data-pipeline/output/` | Writes the final `people.json` and `events.json` into `/packages/shared-types/src/data/` |
| `/data-pipeline/data/raw/` | Checked-in snapshots of raw Wikidata query results, for reproducibility and diffing between pipeline runs |

## Data Pipeline

The pipeline is a separate concern from the frontend and is designed to run on-demand, not continuously — there's no scheduler or live connection to Wikidata once data is generated.

**Stages, in order:**

1. **Fetch** — SPARQL queries pull candidate humans (with birth/death year, occupation claims, sitelink count) and candidate events (inventions, wars, discoveries, with date and sitelink count). Results are written as-is to `/data-pipeline/data/raw/` and checked into version control, so a pipeline run is reproducible and reviewable in a diff without re-hitting Wikidata.
2. **Score** — fame score is computed directly from sitelink count (per the earlier decision in planning); no other signal is blended in for v1.
3. **Tag** — each entry's raw Wikidata occupation and location claims are mapped onto the app's fixed set of occupation categories (science, politics, art, philosophy, war, invention, exploration, religion) and region categories (Europe, East Asia, South Asia, Middle East, Africa, Americas). This mapping is necessarily lossy — Wikidata has thousands of specific occupation values — and lives in `/data-pipeline/transform/` as an explicit, readable lookup table, not inferred at runtime.
4. **Output** — the final `people.json` / `events.json` are generated and written into `/packages/shared-types/src/data/` (the same workspace package that holds the `Person`/`HistoricalEvent` type contracts — see Stack table), becoming a normal input to the frontend build. There is a single copy, not one in `/data-pipeline/output/` and a duplicate in `/src/shared/data/`.

**Explicitly skipped for now:** there is no manual override/correction mechanism in this version of the pipeline. Planning flagged that the automated fame ranking would need sanity-checking (sitelink count skews toward well-documented Western figures), and some automated occupation/region tagging will be wrong or missing — but v1 has no way to correct either without editing the Score or Tag logic directly and re-running the whole pipeline. This is a known gap, not an oversight: if it becomes a real problem in practice, revisit and add a correction mechanism deliberately rather than letting it grow ad hoc.

## Storage Model

There is no database anywhere in the project. The frontend uses bundled JSON plus in-memory state; the pipeline uses checked-in JSON files as its intermediate storage.

| What | Where it lives | Notes |
|---|---|---|
| People dataset (name, birth/death year, occupation tag, region tag, fame score, description, Wikipedia URL) | `/packages/shared-types/src/data/people.json`, imported by `/src` and bundled into the production build | Generated by the pipeline's Output stage; never hand-edited, never written to at runtime |
| Events dataset (name, date, occupation/category tag, region tag, fame score, description, Wikipedia URL) | `/packages/shared-types/src/data/events.json`, imported by `/src` and bundled into the production build | Same as above |
| Raw Wikidata query results | `/data-pipeline/data/raw/`, checked into version control | Untouched SPARQL output; re-running Fetch overwrites these, giving a diffable record of what changed between pipeline runs |
| Current filter state (fame tier, active occupations, active regions) | In-memory React state only | Not persisted; resets on page reload. No localStorage/sessionStorage in v1, since there's nothing to restore for a read-only app with no accounts |
| Current viewport (visible time window) | In-memory React state, initialized to the 1800s / 100-year default | Not persisted between sessions |
| Static assets (JS/CSS bundles, fonts) | Static hosting provider's CDN | Standard HTTP caching via cache headers; no custom cache layer needed |

If a future version adds persistence (e.g., remembering a user's last-viewed period), that would introduce the first legitimate need for browser storage or a backend — explicitly out of scope for v1.

## Auth and Access Model

There is no authentication in v1, by design — this follows directly from the "pure read-only, no accounts, no user-generated content" decision in `project-overview.md`.

- **No login, no user accounts, no sessions.**
- **No ownership model** — there's no concept of "my data" anywhere in the app, since nothing is created or saved by users.
- **Access is uniform and public** — every visitor sees the same dataset with the same filtering capabilities; there are no per-user permissions or roles.
- If a future version needs auth (e.g., for saved views or contributed corrections), it would be introduced as a net-new capability, not an extension of anything in v1.

## AI / Background Task Model

There is no AI or background task system in the running application — the app itself does no inference and makes no runtime calls to any AI service or external API. The only offline process in the project is the data pipeline, covered in full in the **Data Pipeline** section above.

## Invariants

Rules the codebase must never violate:

1. **The app never writes anywhere at runtime.** No mutation of `/packages/shared-types/src/data/*.json`, no writes to a database (none exists), no localStorage/sessionStorage writes. Read-only is a product decision, not just a current limitation — code that introduces persistence must be treated as a scope change, not a bug fix.

2. **Filters are always applied as an intersection, never a union.** A person/event is visible only if it satisfies the active fame tier AND the active occupation filter AND the active region filter simultaneously. No component may implement OR-based filtering, even for a single-filter edge case, since that would silently change what "filtered" means across the app.

3. **Fame tiers are strictly nested.** The "top 300" set must always be a superset of the "top 200" set (i.e., ordered by descending fame score, tier N always includes tier N−1 unchanged). Re-ranking or reshuffling which people appear when the tier changes is never acceptable — it would make the fame selector feel arbitrary rather than progressive.

4. **`Temporal.PlainDate` is the only date type used in application and pipeline code; legacy `Date` exists solely as a one-way adapter output.** No file other than `shared/lib/dates.ts`'s `toLegacyDate()` function — called only from `widgets/timeline-canvas/` — may construct a `Date`. BCE years are always negative years within `Temporal.PlainDate`, end-to-end from the data pipeline through to rendering. This replaces the earlier plan to hand-manage negative years directly on `Date`; `Temporal` supports them as a native part of its calendar, and confining `Date` to a single adapter point means vis-timeline's legacy date requirement can never leak into the rest of the codebase.

5. **The viewport may never exceed the 10-year (min) to 250-year (max) zoom bounds.** Any change to pan/zoom behavior must preserve these limits; the app must never allow a window narrower than 10 years or wider than 250 years, per the explicit product decision to abandon "see all of history at once."

6. **No runtime code may fetch from Wikidata or any external API.** All data enters the app exclusively through the offline pipeline and the resulting static JSON. This keeps the app fast, keeps it working offline/on static hosting, and keeps "what data exists" fully deterministic and reviewable before ship.

7. **`/packages/shared-types/src/data/*.json` is always machine-generated, never hand-edited.** There is currently no override mechanism (see Data Pipeline section) — any correction to a person or event's data means fixing the Score or Tag logic and re-running the pipeline, not editing the generated JSON or adding an ad hoc patch file. Editing the generated JSON directly creates a divergence that a future pipeline run will silently overwrite and lose.

8. **The pipeline's Fetch stage never merges, scores, or tags data.** Raw Wikidata query results are written to `/data-pipeline/data/raw/` untouched. Keeping Fetch pure means a bad scoring or tagging change can be fixed and re-run without needing to re-query Wikidata, and raw snapshots stay diffable across pipeline runs.