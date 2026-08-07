# 04 — Score/Output: wire enrichment data into the Discoveries pipeline

Type: task
Status: resolved
Blocked by: 02, 03

## Question

Update `packages/data-pipeline/src/transform/index.ts`'s `transformDiscoveries` to load the enriched curated file (from ticket "02 — Fetch: batched per-QID enrichment pass for curated events") instead of `events-inventions.raw.json`, using the passthrough-category tagging from ticket "03 — Split Category into Category (Wars) + DiscoveryCategory".

Update scoring (`transform/score.ts`): `fameScore` continues to come from `sitelinks` (now enrichment-sourced rather than candidate-query-sourced) — reuse `scoreAndRankDiscoveries`'s sort-by-sitelinks logic; decide whether the existing `specialist`-floor filter (currently 50) still makes sense against the curated set's sitelink distribution, or should be dropped now that every candidate is already hand-vetted (the *sidebar* floor from ticket 05 is the user-facing filter — this pipeline-internal floor is a separate, earlier gate).

Update `packages/data-pipeline/src/output/write-datasets.ts`'s `buildDiscoveries`/`validateEventRow`: drop rows still missing `wikipediaUrl`/`description`/`sitelinks` after enrichment (per the map's enrichment-failure-handling decision — see Notes). Confirm `regionTags` is allowed to stay empty (it already isn't in the drop-if-missing list).

## Answer

Decided to **drop** the pipeline-internal specialist floor for Discoveries: replaced `scoreAndRankDiscoveries`/`FAME_TIER_MIN_SITELINKS_DISCOVERIES` with `rankDiscoveriesBySitelinks` (sort only, no floor) — the curated set is only ~121 hand-vetted items to begin with (not a huge raw corpus needing volume control), and the sidebar's user-facing fame-score floor (ticket 05) is the density control now anyway, matching ADR 0003's philosophy. `transform/index.ts`'s `transformDiscoveries` reads `events-curated-enriched.raw.json` directly (new `TaggedDiscovery` type, no `groupRows` step needed — already one row per event), coercing a missing enrichment `sitelinks` to `0`. `validateEventRow` genericized over a `<C>` category type param (shared by Wars' `Category` and Discoveries' `DiscoveryCategory`); `buildDiscoveries` now takes `TaggedDiscovery[]` and additionally drops any row with `sitelinks <= 0` (enrichment failure). Live run: 121/121 curated events survived Output with 0 drops.
