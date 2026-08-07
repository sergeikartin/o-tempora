# 07 — Update tests for the new Discoveries architecture

Type: task
Status: resolved
Blocked by: 02, 03, 04, 06

## Question

Update/replace tests that encode the old architecture:

- `packages/data-pipeline/src/fetch/queries/inventions.test.ts` — asserts the old P575/sitelinks candidate-query shape; replace with tests for the new QID-enrichment query (ticket "02 — Fetch: batched per-QID enrichment pass for curated events").
- `packages/data-pipeline/src/transform/tag-events.test.ts` — update/remove the `tagInvention`-always-returns-"invention" assertions and the wars/discoveries category-disjointness test (ticket "03 — Split Category into Category (Wars) + DiscoveryCategory" changes both).
- `packages/data-pipeline/src/transform/score.test.ts` — check assumptions about the Discoveries sitelink-tier floor still hold post-ticket-04.
- `packages/web/src/widgets/timeline-canvas/options.test.ts` — update for the new `CATEGORY_COLORS` shape (ticket "06 — Wire DiscoveryCategory colors into EventsLane").

Run the full `packages/data-pipeline` and `packages/web` test suites and typecheck to confirm nothing else references the old `"invention"` category value or the removed `inventions.ts` candidate-query shape.

## Answer

Added `events-enrichment.test.ts` (query-builder tests, mirrors `reigns.test.ts`/`descriptions.test.ts`'s style — no orchestration test, matching the existing convention of not testing the `fetch-*.ts` I/O wrappers). Updated `tag-events.test.ts` (dropped the `tagInvention`/disjointness tests, added `tagCuratedDiscovery` passthrough + region-tagging tests), `score.test.ts` (dropped Discoveries tier-floor tests, added `rankDiscoveriesBySitelinks` sort-only tests), `write-datasets.test.ts` (new `taggedDiscovery` fixture, dropped the no-mappable-category test since `TaggedDiscovery.category` is no longer optional, added a missing-sitelinks drop test), and three `packages/web` fixtures still using the retired `'invention'` literal (`EventsLane.test.tsx`, `TimelineCanvas.test.tsx`, `map-to-items.test.ts`) plus `options.test.ts` (new `DISCOVERY_CATEGORY_COLORS` completeness test). `inventions.test.ts` itself was deleted in ticket 09, not touched here (stayed valid dead-code-testing-dead-code until then). Full `data-pipeline` (66 tests) and `web` (78 tests) suites + both typechecks + `web`'s lint/lint:boundaries all green.
