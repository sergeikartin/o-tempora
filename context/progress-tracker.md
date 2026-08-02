# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Data pipeline

## Current Goal

- Unit 3: Project scaffold (frontend) — see `context/specs/00-build-plan.md`.

## Completed

- Unit 1: Data pipeline scaffold + Fetch stage.
  - `/data-pipeline` scaffolded: `package.json`, `tsconfig.json` (strict), `.gitignore`, `fetch/`, `transform/` (placeholder), `output/` (placeholder), `data/raw/`.
  - `fetch/sparql-result-shape.ts` + `fetch/validate-sparql-result.ts`: structural validation of the SPARQL JSON shape (head.vars / results.bindings), tested against both valid and malformed input.
  - `fetch/wikidata-client.ts`: paginated (LIMIT/OFFSET, 500 rows/page) POST client against `query.wikidata.org/sparql`, with 429 retry/backoff and graceful stop-and-keep-partial-results on a page failure once at least one page has succeeded.
  - `fetch/queries/{people,historical-events,inventions}.ts`: three verified-live SPARQL query builders.
  - `fetch/fetch-people.ts`, `fetch/fetch-events.ts`, `fetch/index.ts`: orchestration, run via `npm run fetch`.
  - Ran for real against live Wikidata: `data/raw/people.raw.json` (5,500 rows), `data/raw/events-historical.raw.json` (1,938 rows), `data/raw/events-inventions.raw.json` (6,500 rows). Spot-checked content (e.g. Pericles with correct BCE ISO date `-0493-01-01`).

- Unit 2: Score, Tag, Output (see `context/specs/02-data-pipeline-score.md`).
  - **Fetch extension (prerequisite):** added `description` (via `OPTIONAL { ... schema:description ?description . FILTER(LANG(?description)="en") }`) to all three query builders. Verified ~99–100% coverage on re-fetch.
  - **Live re-fetch instability:** the Wikidata Query Service was unstable across 7 consecutive re-fetch attempts on 2026-08-02 (mix of HTTP 502s and request timeouts; confirmed via a diagnostic re-run of the pre-description query that this was ambient service instability, not caused by the `description` addition). Best snapshot obtained: `people.raw.json` 2,000 rows / 345 unique people (down from the original 552 unique / 5,500 rows), `events-historical.raw.json` 1,938 rows / 1,186 unique (matches the original run), `events-inventions.raw.json` 4,000 rows / 3,064 unique (down from 4,691 unique / 6,500 rows). Per your decision, proceeded with this snapshot rather than continuing to retry — the combined events pool (~4,250 unique) still clears the 750 fame-tier ceiling comfortably; the people pool (345 unique) doesn't reach 750 but that's fine, it just means the "more" tier isn't currently binding for people (same non-binding situation the spec already described, just at a lower number than the spec assumed).
  - **Shared types:** per your decision, set up npm workspaces at the repo root (`package.json` with `workspaces: ["data-pipeline", "packages/*"]`) and added `packages/shared-types` (`Person`, `HistoricalEvent`, `Category`, `Region`), imported by `/data-pipeline` now and by `/src/shared/types/` from Unit 3/4 onward. Documented in `architecture.md`'s Stack table and System Boundaries section (compile-time-only exception to the "communicate only through JSON" rule) and in `code-standards.md`'s File Organization section.
  - **`transform/group-rows.ts`:** denormalized SPARQL rows → one record per entity, config-driven so the same function serves all three raw sources. Filters out Wikidata's skolemized-blank-node "unknown value" URIs (`/.well-known/genid/...`, seen 4× in `people.raw.json`'s `country` binding) rather than collecting them as bogus Q-IDs. Covered by `group-rows.test.ts` (Node's built-in `node:test` runner, `npm test` — not Vitest, which is declared for the frontend only).
  - **Category/region lookup tables:** `occupation-categories.ts` (293 Q-IDs, fully mapped), `region-categories.ts` (310 of 318 Q-IDs mapped; the 8 unmapped are all Oceania — Australia, New Zealand, Micronesia, Marshall Islands, Palau, Kiribati, Cook Islands, Pitcairn — deliberately left unmapped per the spec's "no ninth region" rule), `event-type-categories.ts` (closed 8-class set). Built against real Wikidata labels (fetched via a batched SPARQL label query, not guessed from Q-ID numbers). `list-unmapped-occupations.ts` / `list-unmapped-countries.ts` helper scripts confirm the above.
  - **`transform/tag-people.ts`, `transform/tag-events.ts`, `transform/score.ts`, `transform/index.ts`:** group → tag → score orchestration per lane; events lane merges historical events + inventions into one ranked pool before the top-750 slice (confirmed no ID overlap, per spec).
  - **`output/write-datasets.ts`, `output/index.ts`:** constructs final `Person`/`HistoricalEvent` records, applies the drop rules (missing name/article/description/date — `deathYear` missing is not a drop condition), writes `people.json`/`events.json` directly into `packages/shared-types/src/data/` — a single copy, imported by `/data-pipeline`'s own tooling and (from Unit 3/4) `/src` alike, rather than a `data-pipeline/output/` copy duplicated into `src/shared/data/`. (An earlier version of this unit wrote both locations; consolidated to one per your instruction.) Run via `npm run build-data`.
  - **Real output:** `people.json` 344 entries (1 dropped, missing name), `events.json` 693 entries (57 dropped, missing name — all from the low-sitelink tail of the merged top-750 slice). All 344 people have exactly one valid `category` and non-empty `occupationTags`; `regionTags` is `[]` for the 71 people with no mappable country claim.
  - **Known limitation vs. the spec's own worked example:** the spec's verification checklist expects Pericles to land with `category: "politics"`; actual output gives `"war"`. Root cause: "primary category = first occupation claim that maps to a known category, in claim order" relies on SPARQL row order, which is not guaranteed to reflect Wikidata's actual statement/display order (confirmed for Pericles: `military personnel` happens to arrive before `politician` in the raw JSON, even though "politician" is the more prominent claim on Wikidata's own entity page). Per your decision, accepted as a known limitation rather than fixed — a real fix would mean fetching Wikidata statement rank via the full `p:`/`ps:` statement model instead of the `wdt:` shortcut, a Fetch-stage change beyond this unit's scope.
  - `npm run typecheck` clean (strict, no `any`) across `data-pipeline` (including the new `packages/shared-types` import).

## In Progress

- None.

## Next Up

- Unit 3: Project scaffold (frontend) — Vite + React + TypeScript init, mini-FSD folder skeleton, Steiger config. See `context/specs/00-build-plan.md`. When `shared/types/` is created, it should import from `packages/shared-types` rather than redefining `Person`/`HistoricalEvent`; the app's data loading should import `people.json`/`events.json` directly from `packages/shared-types/src/data/` rather than expecting a `src/shared/data/` copy.

## Open Questions

- None blocking. Worth revisiting later:
  - Whether the `events-inventions.raw.json` candidate set (anything with `wdt:P575`, "time of discovery or invention") is too geography-heavy (island/strait discoveries) relative to technological inventions — a call for Transform's tagging step, not Fetch.
  - Whether to re-fetch people again later (once the Wikidata Query Service is stable) to grow the 345-unique pool back toward the original 552 — not urgent, since 345 already clears the 200/300 fame tiers the app defaults to.
  - Whether the "first mapped occupation claim in raw SPARQL row order" primary-category rule needs a real fix (see Pericles note above) before this matters for more people than just the one spot-checked.

## Architecture Decisions

- **Events split into two raw files, not one.** `project-overview.md`/`architecture.md` describe "candidate events (inventions, wars, discoveries)" as one Fetch concern, but wars/battles/treaties (typed via `wdt:P31` against an explicit class list: war, battle, treaty, siege, revolution, rebellion, military operation, historical event) and inventions/discoveries (identified via `wdt:P575`, since Wikidata has no single umbrella "invention" class most invented things are typed under) are structurally different SPARQL queries. Writing them into one file would mean Fetch reshapes data, which Invariant 8 reserves for Transform. So Fetch writes `events-historical.raw.json` and `events-inventions.raw.json` as two untouched snapshots; Transform normalizes both into one `events.json`.
- **No `ORDER BY sitelinks` in Fetch queries.** Sorting by `wikibase:sitelinks` over the full join forces Blazegraph to materialize and sort the whole match set before applying LIMIT, which times out at this corpus size. Fetch queries use a `FILTER(?sitelinks > N)` threshold with no ordering instead — Fetch doesn't rank anyway (Invariant 8); Score does the real ranking.
- **Pagination has a soft ceiling, by design** — but on 2026-08-02 the live query service failed much earlier than the originally observed ~6,000–7,000 offset ceiling (as low as offset 500 on some runs), confirmed to be ambient service instability rather than the `description` field's added query cost. `fetchAllPages` in `wikidata-client.ts` already treats a page failure as "pool exhausted for practical purposes" once at least one page has succeeded — this behaved as designed, it just triggered sooner than usual today.
- **Node's native `fetch` needs `NODE_USE_ENV_PROXY=1`** to respect `HTTP_PROXY`/`HTTPS_PROXY` env vars (unlike `curl`, which does this automatically). Baked into the `fetch` npm script; it's a no-op on machines without a proxy configured.
- Labels are fetched via a plain `?x rdfs:label ?xLabel . FILTER(LANG(?xLabel)="en")` pattern rather than the `SERVICE wikibase:label` convenience service — the label service added enough overhead (a few seconds becoming 60+) to blow past the page timeout budget once multiple labels were requested per row.
- **`group-rows.ts` only accepts real `/entity/QN` URIs.** Wikidata's RDF mapping represents an "unknown value" claim as a skolemized blank node under `/.well-known/genid/...`, still SPARQL type `"uri"` but not an entity reference — seen in real data (4 rows in `people.raw.json`'s `country` field) and filtered out rather than collected as a bogus Q-ID.
- **Shared `Person`/`HistoricalEvent` types live in `packages/shared-types`, a new npm-workspace package** — resolves the package-boundary question `02-data-pipeline-score.md` explicitly flagged as open, rather than deciding it silently or duplicating the types. See `architecture.md`'s Stack table and System Boundaries section.
- **No "commerce" or "sport" category exists in the app's fixed 8-value set.** Merchant/business/trade occupations are mapped to `invention` (closest to industry/craft) and historical "athlete" is mapped to `war` (most historical Wikidata "athlete" entries are ancient-Greek competitors in martial events) — both explicit judgment calls, not real Wikidata signals, documented inline in `occupation-categories.ts`.

## Session Notes

- To re-run Fetch: `cd data-pipeline && npm install && npm run fetch`. Re-running overwrites the three raw files (expected/intended — see Invariant 8 and the Data Pipeline section of `architecture.md`).
- To rebuild the dataset after a Fetch re-run: `cd data-pipeline && npm run build-data` (writes `people.json`/`events.json` into `../packages/shared-types/src/data/`).
- Typecheck: `cd data-pipeline && npm run typecheck` (clean, strict mode, no `any`). Tests: `npm test` (Node's built-in `node:test` runner).
- Root-level `npm install` (from the repo root, not `data-pipeline/`) is what links the `packages/shared-types` workspace package — needed once, or after `packages/shared-types/package.json` changes.
- If occupation/region lookup tables ever need extending (e.g. after a Fetch re-run surfaces new Q-IDs), run `npx tsx transform/list-unmapped-occupations.ts` / `list-unmapped-countries.ts` from `data-pipeline/` and fill in the reported gaps.
