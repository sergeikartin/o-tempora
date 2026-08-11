# 05 — Update Transform's loaders for per-lane raw files

**What to build:** `packages/data-pipeline/src/transform/index.ts`'s three loaders (`loadImageAttributionFile`, `loadPageviewsFile`, `loadWikipediaExtractsFile`) currently each read one combined raw file and index into a `.people`/`.wars`/`.discoveries` sub-object. Update each to read the new per-lane raw files from issues 01–03 instead — e.g. `transformPeople` reads `people-image-attribution.raw.json` and `people-wikipedia-extracts.raw.json` directly, rather than reading a combined file and picking `.people` out of it.

**Blocked by:** 01 — Split `fetchImageAttribution`; 02 — Split `fetchPageviews`; 03 — Split `fetchWikipediaExtracts`

**Status:** resolved

- [x] `transformPeople`, `transformWars`, `transformDiscoveries` each read only their own lane's raw files for image attribution, pageviews (Wars/Discoveries only), and Wikipedia extracts.
- [x] The combined-file loader functions and their `.people`/`.wars`/`.discoveries` indexing are removed, not left dead.
- [x] `transform/index.test.ts` fixtures/mocks updated to match the new per-lane file reads.
- [x] `npm run build-data --workspace packages/data-pipeline` produces byte-identical output to a pre-change run against the same underlying data (sanity check that the split is a pure refactor, not a behavior change).
