# 02 — Fetch: curated wars boundary validation + Wikidata enrichment pass

Type: task
Status: open
Blocked by: 01

## Question

**Curated file shape** (`data/raw/wars-curated.raw.json`): `{ wars: CuratedWar[] }` where `CuratedWar` is `{ id: string; name: string; category: ConflictCategory; parentId?: string }` — bare Wikidata QID as `id`, six-value shrunk `category` (ticket 01), optional `parentId`. No `year`/`endYear`/`description`/`source` — those are either Wikidata-enriched (below) or dropped entirely (no provenance tracking needed; there's exactly one source, the hand-off list ticket 05 bootstraps from).

**Boundary validation**, mirroring `validateCuratedEventsFile`/`validateEnrichedEventsFile` in `fetch-events-enrichment.ts`:

- `validateCuratedWarsFile` — checks `id`/`name`/`category` (against the six-value `ConflictCategory`) are present and correctly typed, `parentId` is a string when present.
- `validateEnrichedWarsFile` — same plus the optional enrichment fields below.

**Enrichment pass** (`src/fetch/queries/wars-enrichment.ts` + `src/fetch/fetch-wars-enrichment.ts`, mirroring `queries/events-enrichment.ts`/`fetch-events-enrichment.ts`'s batched `VALUES`-clause pattern): given the curated file's QIDs, batch-fetch per QID:

- `wikibase:sitelinks` → `sitelinks` (required; missing means the QID didn't resolve)
- English Wikipedia article (`schema:about`/`schema:isPartOf <https://en.wikipedia.org/>`) → `wikipediaUrl`
- `wdt:P17` → `country` (repeatable) → `regionTags` downstream
- `wdt:P18` → `image`
- `schema:description` (`FILTER(LANG(?description) = "en")`) → `description`
- Start/end date with precision — reuse the exact pattern `queries/historical-events.ts`'s `buildHistoricalEventsQuery` already has: `p:P585`/`psv:P585` point-in-time OR `p:P580`/`psv:P580` start-time (via `COALESCE`, same as the existing query), each with `wikibase:timePrecision`; separately `p:P582`/`psv:P582` end-time with its own precision. Do **not** filter by year range or apply `MIN_SITELINKS` — this is a per-QID batch of already-curated ids, not a corpus scan.

Write the merged result to `data/raw/wars-curated-enriched.raw.json`. Wire `fetchWarsEnrichment` into `src/fetch/index.ts`'s `main()`.

**Tests**: `queries/wars-enrichment.test.ts` covering the query-builder's date-precision `OPTIONAL` logic (mirroring `queries/historical-events.test.ts`'s existing coverage) and the `VALUES`-clause batching. Not unit tested: the live SPARQL call itself, consistent with every other `fetch/fetch-*.ts` entrypoint in this pipeline.

## Answer
