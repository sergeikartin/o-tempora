# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Data pipeline

## Current Goal

- Unit 2: Score, Tag, Output — compute fame score from sitelinks, map raw occupation/location claims to the app's fixed tag sets, write `people.json`/`events.json` to `/data-pipeline/output/` and copy to `/src/shared/data/`.

## Completed

- Unit 1: Data pipeline scaffold + Fetch stage.
  - `/data-pipeline` scaffolded: `package.json`, `tsconfig.json` (strict), `.gitignore`, `fetch/`, `transform/` (placeholder), `output/` (placeholder), `data/raw/`.
  - `fetch/sparql-result-shape.ts` + `fetch/validate-sparql-result.ts`: structural validation of the SPARQL JSON shape (head.vars / results.bindings), tested against both valid and malformed input.
  - `fetch/wikidata-client.ts`: paginated (LIMIT/OFFSET, 500 rows/page) POST client against `query.wikidata.org/sparql`, with 429 retry/backoff and graceful stop-and-keep-partial-results on a page failure once at least one page has succeeded.
  - `fetch/queries/{people,historical-events,inventions}.ts`: three verified-live SPARQL query builders.
  - `fetch/fetch-people.ts`, `fetch/fetch-events.ts`, `fetch/index.ts`: orchestration, run via `npm run fetch`.
  - Ran for real against live Wikidata: `data/raw/people.raw.json` (5,500 rows), `data/raw/events-historical.raw.json` (1,938 rows), `data/raw/events-inventions.raw.json` (6,500 rows). Spot-checked content (e.g. Pericles with correct BCE ISO date `-0493-01-01`).

## In Progress

- None.

## Next Up

- Unit 2: Score, Tag, Output (see `context/specs/00-build-plan.md`).

## Open Questions

- None blocking. Worth revisiting later: whether the `events-inventions.raw.json` candidate set (anything with `wdt:P575`, "time of discovery or invention") is too geography-heavy (island/strait discoveries) relative to technological inventions — a call for Transform's tagging step, not Fetch.

## Architecture Decisions

- **Events split into two raw files, not one.** `project-overview.md`/`architecture.md` describe "candidate events (inventions, wars, discoveries)" as one Fetch concern, but wars/battles/treaties (typed via `wdt:P31` against an explicit class list: war, battle, treaty, siege, revolution, rebellion, military operation, historical event) and inventions/discoveries (identified via `wdt:P575`, since Wikidata has no single umbrella "invention" class most invented things are typed under) are structurally different SPARQL queries. Writing them into one file would mean Fetch reshapes data, which Invariant 8 reserves for Transform. So Fetch writes `events-historical.raw.json` and `events-inventions.raw.json` as two untouched snapshots; Transform will normalize both into one `events.json`.
- **No `ORDER BY sitelinks` in Fetch queries.** Sorting by `wikibase:sitelinks` over the full join forces Blazegraph to materialize and sort the whole match set before applying LIMIT, which times out at this corpus size. Fetch queries use a `FILTER(?sitelinks > N)` threshold with no ordering instead — Fetch doesn't rank anyway (Invariant 8), so arbitrary internal ordering is fine; Score will do the real ranking in Unit 2.
- **Pagination has a soft ceiling, by design.** `OFFSET` cost grows with depth on the live query service (observed real timeouts around offset 6,000–7,000). `fetchAllPages` in `wikidata-client.ts` treats a page failure as "pool exhausted for practical purposes" once at least one page has succeeded, keeping whatever was already collected rather than failing the whole run. The resulting candidate pools (5.5k people, ~8.4k events/inventions) are already far larger than any fame tier the app will use.
- **Node's native `fetch` needs `NODE_USE_ENV_PROXY=1`** to respect `HTTP_PROXY`/`HTTPS_PROXY` env vars (unlike `curl`, which does this automatically). Baked into the `fetch` npm script; it's a no-op on machines without a proxy configured, so it doesn't hurt environments that don't need it.
- Labels are fetched via a plain `?x rdfs:label ?xLabel . FILTER(LANG(?xLabel)="en")` pattern rather than the `SERVICE wikibase:label` convenience service — the label service added enough overhead (a few seconds becoming 60+) to blow past the page timeout budget once multiple labels were requested per row.

## Session Notes

- To re-run Fetch: `cd data-pipeline && npm install && npm run fetch`. Re-running overwrites the three raw files (expected/intended — see Invariant 8 and the Data Pipeline section of `architecture.md`).
- Typecheck: `cd data-pipeline && npm run typecheck` (clean, strict mode, no `any`).
- Next session should start Unit 2 by reading the three raw files' actual shape (denormalized: one row per occupation/type/country combination per entity) before designing the Transform grouping logic.
