# Reconcile region-tag mapping for the 3 brand-new categories

Type: task
Status: resolved
Blocked by: 03

## Question

`transform/region-categories.ts`'s `REGION_CATEGORIES` was hand-built against the distinct country Q-IDs actually present in the old combined corpus (via `list-unmapped-countries.ts`). The 3 brand-new categories (coup-d'état, war-of-independence, peace-treaty — none were fetched before this effort) may surface country/polity Q-IDs `REGION_CATEGORIES` doesn't cover yet, which would silently resolve those rows to "no region" per the existing `regionTagsFor` behavior.

After the fetch-split ticket lands and the new per-category raw files exist, run `list-unmapped-countries.ts` (or its equivalent once retagging lands) against the newly-fetched data and add any missing Q-ID → `Region` entries to `REGION_CATEGORIES`, following the existing convention (map historical polities to the region their territory geographically corresponds to; Oceania/Australia stays deliberately unmapped per the existing comment).

## Answer

`list-unmapped-countries.ts` updated to read the 9 new per-category raw files (`CONFLICT_CATEGORY_QUERIES`) instead of the retired single `events-historical.raw.json`, then run against the real live fetch ("Run the restructured pipeline end-to-end and publish fresh data"). Found 2 unmapped country Q-IDs, both added to `REGION_CATEGORIES` following the existing historical-polity-to-geographic-region convention:

- `Q112660052` (British India) -> `south-asia`, alongside the existing `Q129286` (British Raj) entry.
- `Q804` (Panama) -> `americas`, alongside the existing Central American entries.

Re-ran `list-unmapped-countries.ts` after the additions: "No unmapped country Q-IDs."
