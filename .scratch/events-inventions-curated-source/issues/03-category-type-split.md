# 03 — Split Category into Category (Wars) + DiscoveryCategory

Type: task
Status: resolved

## Question

In `packages/shared-types/src/index.ts`: remove `"invention"` from the existing `Category` enum (used by `War`), and add a new `DiscoveryCategory` enum with the 10 values from `events-curated.raw.json`'s `meta.categories` (`science-theory`, `medicine-health`, `communication`, `transportation`, `infrastructure`, `everyday-technology`, `food-agriculture`, `exploration`, `energy-industry`, `society-administration`). Change `Discovery.category` to `DiscoveryCategory`.

In `packages/data-pipeline/src/transform/tag-events.ts`: replace `tagInvention` (currently hardcodes `category: "invention"` for every row) with logic that passes through the curated file's own `category` field directly — the curated data is already classified by hand, no lookup-table tagging needed for this lane anymore. Update `tag-events.test.ts`'s wars/discoveries category-disjointness assertions accordingly (the invariant "invention only ever comes from tagInvention" no longer applies since `DiscoveryCategory` is a disjoint type from `Category`, not a shared value).

Check `REGION_CATEGORIES`/region-tagging logic is unaffected (it stays keyed on `?country`, independent of this change).

## Answer

`packages/shared-types/src/index.ts`: removed `"invention"` from `CATEGORIES`/`Category`; added `DISCOVERY_CATEGORIES`/`DiscoveryCategory` (10 values, verbatim from the curated file's `meta.categories`); `Discovery.category` retyped to `DiscoveryCategory`. `tag-events.ts`: replaced `tagInvention` with `tagCuratedDiscovery(category, countries)` (straight passthrough); generalized the private `regionTagsFor` to take `countries: string[]` directly (was `GroupedRow`) so both taggers can share it. Confirmed `REGION_CATEGORIES` itself untouched — still keyed on Wikidata country QIDs, now sourced from enrichment's `?country` instead of the old candidate query's.
