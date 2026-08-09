# Wire P18/Commons image enrichment into the Wars & Conflicts pipeline

Type: task
Status: resolved
Blocked by: 03, 10

## Question

Land image sourcing for Wars & Conflicts, per the coverage/wiring recommendation from "Research P18/Commons image coverage for the new Wars & Conflicts categories":

1. Add `image`/`imageAttribution` population to the Wars & Conflicts fetch/transform stages, mirroring the existing People/Discoveries pattern (`fetch-image-attribution.ts`'s batched Commons `imageinfo` pass, keyed by Wikidata QID — already the `id` for War/WarEvent) — either by extending the 9 per-category SPARQL queries with an `OPTIONAL { ?event wdt:P18 ?image }` clause, or a standalone pass, per ticket 10's recommendation.
2. Confirm `output/write-datasets.ts`'s War/WarEvent builders pass `image`/`imageAttribution` through (they're already-optional `TimelineEntry` fields — likely just needs the same shape-passthrough treatment `description`/`wikipediaUrl` already get, per the Dynamic tooltips spec §4.2, but verify rather than assume since War/WarEvent's builder may currently omit them explicitly).
3. Update `packages/shared-types/src/index.ts`'s `TimelineEntry.image`/`imageAttribution` JSDoc — it currently states these fields are "for War/WarEvent, simply never populated — Wars & Conflicts images are out of scope." That's reversed; update the comment accordingly.

Does not touch the frontend rendering side (drawer content builder, spec.md) — that's "Render images for Wars & Conflicts in the entity detail drawer."

## Answer

Landed, per ticket 10's "extend the queries directly" recommendation. `fetch/queries/historical-events.ts`'s per-category query gained `?image` in the SELECT and `OPTIONAL { ?event wdt:P18 ?image . }`, same "extend the existing OPTIONAL set" treatment as `descriptions.ts`/`events-enrichment.ts`.

`transform/group-rows.ts` gained `imageVar?: string` on `GroupRowsConfig` and `image?: string` on `GroupedRow`, first-value-wins across duplicate rows for the same entity (P18 isn't single-valued) — same convention as `label`/`article`/`description`. `transform/index.ts`'s `HISTORICAL_CONFIG` now sets `imageVar: "image"`.

`fetch-image-attribution.ts` gained a third `wars` extraction pass, reading all 9 `CONFLICT_CATEGORY_QUERIES` raw files directly (same id/imageUri extraction shape as the existing `peopleEntries` pass) and running it through the existing generic `batchedCommonsImageAttributionFetch` — no new machinery, per ticket 10's recommendation. Output shape gained a third `wars: Record<string, string>` key alongside `people`/`discoveries`; `fetch/index.ts`'s ordering comment updated to note the new dependency on `fetchHistoricalEvents`' raw output.

`transform/index.ts`: `TaggedEvent` widened to `GroupedRow & EventTags & { imageAttribution?: string }`; `loadImageAttributionFile`/`ImageAttributionFile` gained the `wars` key; `transformWars()` now looks up each row's `imageAttribution` off that map by id, same pattern `transformDiscoveries` already uses. `output/write-datasets.ts`'s `buildWars` passes `image`/`imageAttribution` through on its `shared` object using the same `...(row.image ? {...} : {})` omit-when-absent convention `buildPeople`/`buildDiscoveries` already use.

`shared-types/src/index.ts`'s `TimelineEntry.image` JSDoc rewritten — no longer says Wars & Conflicts is out of scope; now describes all four entity types uniformly.

New tests: `group-rows.test.ts` (imageVar first-wins across duplicate rows; image stays undefined with no imageVar configured), `write-datasets.test.ts` (buildWars image/imageAttribution passthrough, and the omit-when-absent shape check). `npm run typecheck`/`test --workspace packages/data-pipeline` clean (113/113).

Does not touch the frontend — that's "Render images for Wars & Conflicts in the entity detail drawer."
