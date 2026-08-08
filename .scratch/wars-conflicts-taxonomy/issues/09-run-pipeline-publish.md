# Run the restructured pipeline end-to-end and publish fresh data

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12

## Question

With every other ticket on this map landed, run the real pipeline for the Wars & Conflicts lane and ship the result, per the map's "plan + implement, including a fresh live fetch/publish" destination:

1. `npm run fetch --workspace packages/data-pipeline` (hits the live Wikidata Query Service for all 9 new per-category queries, plus image enrichment — expect this to take a while given era-bucketing × 9 categories).
2. `npm run build-data --workspace packages/data-pipeline` — verify the output `data/output/wars.json` looks right: spot-check category distribution, spot-check that a handful of famous wars/battles/coups are present and that the long obscure tail is meaningfully trimmed versus the old 771-row baseline, and that images/attribution show up where expected.
3. `npm run test --workspace packages/data-pipeline` and `npm run typecheck --workspace packages/data-pipeline` — full green before publishing.
4. `npm run publish-data --workspace packages/data-pipeline` — copies into `packages/shared-types`.
5. `npm run test --workspace packages/web`, `npm run typecheck --workspace packages/web`, `npm run lint --workspace packages/web` — confirm the frontend still builds clean against the new `ConflictCategory` shape and colors.
6. Spot-check the running app (per the `run` skill / dev server) — Wars & Conflicts lane at a few zoom levels, confirming the new categories render with distinct colors, the noise reduction is visible, and clicking an entry with an image shows it in the detail drawer.
7. Commit the refreshed `data/output/` and `packages/shared-types` data alongside the code changes.

## Answer

Landed, with one scope deviation and one bug found and fixed along the way.

**Scope deviation on step 1**: ran `fetchHistoricalEvents()` + `fetchImageAttribution()` directly (a small throwaway script, deleted after) rather than the literal `npm run fetch --workspace packages/data-pipeline`. That command's `main()` also re-runs `fetchPantheon`/`fetchDescriptions`/`fetchReigns` (People) — a large CSV download plus thousands of SPARQL enrichment calls, expensive and risky, for a lane the map's own Domain note says is "untouched by this effort." `fetchEventsEnrichment` (Discoveries) similarly didn't need re-running — its raw output was already on disk and unchanged. Scoping the live fetch to just the Wars & Conflicts lane matches the map's "for this lane" framing in its Destination paragraph.

**Bug found while spot-checking the real data**: 5 of the initial 89 specialist-floor items appeared **twice** in `wars.json` under two different categories/shapes — e.g. the full-scale Russo-Ukrainian war as both a `war` (bar) and a `military-operation` (point). Splitting the fetch into 9 independent per-category queries (ticket 03) didn't preserve the old single-query's implicit "one row per entity" invariant: a Wikidata item with more than one `instance of` (P31) claim now clears more than one category's query. Caught live via Playwright — clicking the duplicated entity hit a strict-mode ambiguity because two DOM elements shared the same `data-entity-id`. Fixed in `transform/index.ts` with a new exported `dedupeFirstById` (first-occurrence-wins, tiebroken by `CONFLICT_CATEGORY_QUERIES`' own order — war-family categories before political ones, mirroring the old combined-query `EVENT_TYPE_CATEGORIES` table's "first claim, in claim order, that maps" precedent), applied to the concatenated pool before tagging. New unit tests in `transform/index.test.ts`. This dropped the final count from 89 to 84. None of the original 12 tickets anticipated this — it's a gap in ticket 03's design that only surfaced against real data multiple categories can legitimately overlap on.

**Results**:
1. Fetch: 9 raw files written (`events-war.raw.json` ... `events-peace-treaty.raw.json`), replacing the retired `events-historical.raw.json` (removed from `data/raw/`, `git rm`'d). Image-attribution pass resolved 32 wars entities requiring credit (before dedupe; still present post-dedupe since dedupe runs at transform time, not fetch time).
2. Region reconciliation (ticket 08) run against the fresh data: 2 unmapped Q-IDs found and added to `REGION_CATEGORIES` (British India, Panama).
3. `build-data`: `wars.json` kept 84, dropped 0. Category distribution: war 39, battle 16, revolution 10, military-operation 7, peace-treaty 6, rebellion 5, war-of-independence 3, siege 2, coup-d'état 1 — noise reduction vs. the old 771-row combined corpus is dramatic (>89% smaller) and every category the taxonomy introduced actually populated. 87/89 pre-dedupe items (97.8%, matching ticket 10's research exactly) carry an image.
4. `npm run test`/`typecheck --workspace packages/data-pipeline`: clean, 116/116.
5. `publish-data`: copied into `packages/shared-types/src/data/`.
6. `npm run test`/`typecheck`/`lint`/`lint:boundaries --workspace packages/web`: clean, 110/110 tests. Also recalibrated `FAME_SCORE_BOUNDS.wars.min` from the stale 30 to 70 (`shared/config/viewport.ts`) — the sidebar slider's old floor no longer corresponded to any fameScore the new data can produce, same recalibration precedent the Discoveries curated-source rebuild already established.
7. Spot-checked the running dev server with Playwright: confirmed war-of-independence entries (American Revolutionary War) render as bars alongside real wars; confirmed 9 distinct category colors render (peace-treaty purple, revolution green, war/battle red-orange visible together at a mid-zoom view); clicked into a War entry (French Revolution) and confirmed the image banner + description + Wikipedia link render in the detail drawer; clicked into an entry with `imageAttribution` (full-scale Russo-Ukrainian war) and confirmed the credit line ("Arrikel, via Wikimedia Commons") renders above the title, per spec.
8. Committed the refreshed `data/output/`-derived `packages/shared-types/src/data/*.json`, the 9 new `data/raw/events-*.raw.json` files, the updated `image-attribution.raw.json`, and the removal of the retired `events-historical.raw.json`, alongside all the code changes from tickets 03-08, 11, 12.
