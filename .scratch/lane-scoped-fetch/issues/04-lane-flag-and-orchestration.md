# 04 — `fetch/index.ts`: add `--lane` flag and per-lane orchestration

**What to build:** `packages/data-pipeline/src/fetch/index.ts` currently runs a fixed sequence of all eight fetch stages unconditionally. Add a `--lane=<value>` CLI flag (`people`/`wars`/`discoveries`; omitted = all three, today's existing behavior) that runs only the requested lane's stages, in the correct dependency order, calling the now-lane-scoped stages from issues 01–03.

**Blocked by:** 01 — Split `fetchImageAttribution`; 02 — Split `fetchPageviews`; 03 — Split `fetchWikipediaExtracts`

**Status:** ready

- [ ] `--lane=people` runs `fetchPantheon` → `fetchTaglines`/`fetchReigns` → the People slice of `fetchImageAttribution`/`fetchWikipediaExtracts` (People has no pageviews stage), preserving today's documented ordering/dependency comments.
- [ ] `--lane=wars` runs `fetchWarsEnrichment` → the Wars slice of `fetchImageAttribution`/`fetchPageviews`/`fetchWikipediaExtracts`.
- [ ] `--lane=discoveries` runs `fetchEventsEnrichment` → the Discoveries slice of `fetchImageAttribution`/`fetchPageviews`/`fetchWikipediaExtracts`.
- [ ] No `--lane` flag: behavior is unchanged from today — all three lanes, same order as the current `main()`.
- [ ] An invalid `--lane` value fails fast with a clear error listing the valid values, rather than silently running everything or silently doing nothing.
- [ ] `packages/data-pipeline/package.json`'s `fetch` script and its invocation docs (`CLAUDE.md`) still work unmodified for the no-flag case.
