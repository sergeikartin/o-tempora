# 03 — Live pipeline run and publish

**What to build:** A real, end-to-end run of the pipeline with the new blended fameScore live — fetch, build, and publish real data, confirming ADR 0010's decision is actually shipping in the app rather than only implemented in isolated modules. See [the spec](../spec.md) for full context.

**Blocked by:** 01 (pageviews fetch stage), 02 (blended fameScore + wiring)

**Status:** done

- [x] `npm run fetch` runs live against real Wikidata/Wikimedia data end to end, including the new pageviews fetch stage, with no unhandled failures.
- [x] `npm run build-data` runs against that real fetched data, producing Wars/Discoveries datasets with real blended `fameScore` values.
- [x] A spot check of the built dataset confirms plausible ranking movement consistent with the ADR's own pilot (e.g. sustained-high-readership entities like World War II ranking competitively against high-sitelink entities like Internet/Computer, rather than being suppressed by the sitelinks-only ranking).
- [x] No unexpected regression in row drop rate versus the pre-change dataset (the sitelinks-unresolved drop gate should behave identically; pageviews-fetch failures should degrade scores, not drop rows).
- [x] `npm run publish-data` copies the new output into `packages/shared-types`, and the app reflects the new scores when run locally against the published data.

## Comments

Live run completed. Notes:

- The initial live run surfaced a real bug from ticket 01/02's implementation: the widened SPARQL queries renamed the single `?article` binding to per-language `?articleEn`/`?articleZh`/etc., but `fetch-wars-enrichment.ts`/`fetch-events-enrichment.ts` still read the now-nonexistent `row.article` for `wikipediaUrl`, silently nulling it for every row. This caused `build-data` to drop all 154 wars and all 121 discoveries ("missing Wikipedia article"). Fixed by deriving `wikipediaUrl` from `articleUrls.en` after the per-language loop; re-ran just `fetch-wars-enrichment.ts`/`fetch-events-enrichment.ts` (not the full pipeline — pageviews/image-attribution/Pantheon data were unaffected) and re-ran `build-data`.
- The pageviews stage hit real Wikimedia 429 rate-limiting during the first ~7 of 21 batches (100 concurrent requests at start, from running the wars/discoveries `batchedPageviewsFetch` calls in parallel) — ~70 of ~1,925 individual calls (3.6%) failed and degraded to 0 for that language, fully recovering by batch 8. WWII (Q362) was unaffected. This is within ADR 0010's designed "pageviews-fetch failure degrades to 0, doesn't drop the row" behavior, not a correctness bug — noted here in case the concurrency should be tuned down in a future pass.
- Spot check: WWII's real trailing-4-year pageviews total (140,635,218) landed almost exactly at the ADR's own pilot-derived ceiling (143,235,719) — strong validation the formula/benchmarks transferred correctly to the full run. Built `fameScore`: WWII 97 (wars max), World War I 95, French Revolution 90; Internet 95, Computer 94 (discoveries top two, as expected — highest sitelinks). Wars/discoveries `fameScore` ranges: 33–97 and 52–95 respectively, both within the new 1–100 bounds.
- Drop rate: wars 145/154 kept, discoveries 121/121 kept — identical to the pre-change published counts (145/121). The 9 dropped wars are pre-existing curation gaps (missing date, bad `parentId` references), unrelated to this change.
- Published to `packages/shared-types/src/data/{wars,discoveries,people}.json`; confirmed via a local dev-server + browser smoke test that all three lanes render with real data and the sidebar's fame-score filters default to 75/75 for Wars/Discoveries as expected.
