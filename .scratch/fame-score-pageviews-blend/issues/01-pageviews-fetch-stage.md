# 01 — Pageviews fetch stage

**What to build:** A new pipeline fetch stage that, for every curated Wars & Conflicts and Discoveries & Inventions entity, resolves its Wikipedia article title in a fixed 7-language basket (en/zh/es/fr/de/ar/ru) and sums each language's trailing-4-full-calendar-year monthly pageviews via the Wikimedia Pageviews REST API, writing the per-entity totals to a new raw file. This is the data-acquisition half of [ADR 0010](../../../packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md) — see [the spec](../spec.md) for full context.

**Blocked by:** None — can start immediately.

**Status:** code-complete — live-data verification deferred to ticket 03

- [x] The wars and events per-QID enrichment SPARQL queries are widened with one `OPTIONAL` binding per additional language (zh/es/fr/de/ar/ru), structurally identical to the existing English `?article` binding, and the enriched-file types/boundary validators are extended to carry the resolved per-language titles.
- [x] A new pageviews REST client module exists, structurally parallel to the existing Commons imageinfo client: correct endpoint/URL construction (project, article title with underscores, monthly granularity, trailing-4-full-calendar-year date range), a courtesy `User-Agent` header, retry-with-backoff on 429/502/503/504, and a 404 (no data for that title/period) treated as 0 pageviews rather than an error.
- [x] A new fetch stage reads the now-widened wars/events enriched raw files, calls the pageviews client once per (curated id × resolved language), sums across languages per entity (missing/unresolved title contributes 0), and writes a new raw file keyed by curated id the same way `image-attribution.raw.json` is keyed (`wars`/`discoveries`), paced with a courtesy delay between request groups matching this pipeline's existing batching conventions.
- [x] The new stage is wired into the fetch entrypoint after the wars/events enrichment stages, matching how `fetchImageAttribution` already depends on and runs after both.
- [x] The pageviews client has direct unit test coverage (mocked `fetch`) asserting: correct request URL shape, successful-response parsing into a pageviews total, 404 → 0, and retry-then-success on 429/502-504 — mirroring `commons-client.test.ts`'s existing pattern.
- [ ] Running the fetch stage against real data produces a valid raw pageviews file with plausible per-entity totals for a spot-checked sample (e.g. a high-traffic entity like World War II clearly outranks a low-traffic curated entry). — requires a live pipeline run; see ticket 03.

## Comments

Implemented: `src/fetch/pageviews-languages.ts` (shared 7-language basket + article-URL validator), widened `buildWarsEnrichmentQuery`/`buildEventsEnrichmentQuery` with per-language `OPTIONAL` article bindings, `EnrichedWar`/`EnrichedEvent` now carry `articleUrls`, new `src/fetch/pageviews-client.ts` (`fetchArticlePageviews`) and `src/fetch/batched-pageviews-fetch.ts` (`batchedPageviewsFetch`, `trailingFourYearWindow`, `extractWikipediaArticleTitle`), new `src/fetch/fetch-pageviews.ts` stage writing `data/raw/pageviews.raw.json`, wired into `src/fetch/index.ts` after the wars/events enrichment stages. All unit tests and typecheck pass. Not yet run against live Wikidata/Wikimedia data.
