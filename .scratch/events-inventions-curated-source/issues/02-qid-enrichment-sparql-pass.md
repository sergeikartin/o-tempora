# 02 — Fetch: batched per-QID enrichment pass for curated events

Type: task
Status: resolved

## Question

Build a new Fetch-stage step that takes the 121 QIDs from `packages/data-pipeline/data/raw/events-curated.raw.json` and runs a batched Wikidata SPARQL query (`VALUES` clause over QIDs, mirroring the batched enrichment pattern already used for People's descriptions/reign-periods) to fetch, per QID: `sitelinks`, an English Wikipedia article URL (`schema:about`/`schema:isPartOf <https://en.wikipedia.org/>`, as `inventions.ts`'s old query did), and `country` (`wdt:P17`, optional — many curated events have no natural country).

Write the merged result (curated fields + enrichment fields) to a new raw output file (e.g. `data/raw/events-curated-enriched.raw.json`), checked into the repo per existing convention. `dateProperty` from the curated file is dropped at this step — not carried forward (see map Notes).

121 QIDs is small enough for a single batched query — no pagination needed (unlike the old candidate-fetch query's LIMIT/OFFSET).

## Answer

Built `src/fetch/queries/events-enrichment.ts` (`buildEventsEnrichmentQuery`, required `wikibase:sitelinks`, optional article/country, VALUES-clause batched) and `src/fetch/fetch-events-enrichment.ts` (reads the curated file, calls `batchedSparqlFetch`, merges enrichment onto curated fields, writes `data/raw/events-curated-enriched.raw.json`). Wired into `src/fetch/index.ts`'s `main()`. Ran live against Wikidata: 121/121 QIDs resolved in 3 batches, 0 failures.
