# Per-category fame-tier floor tables in score.ts

Type: task
Status: resolved
Blocked by: 01, 04

## Question

`transform/score.ts`'s `scoreAndRank` filters/sorts by one shared `FAME_TIER_MIN_SITELINKS_WARS` floor (specialist=30) regardless of type. By the time `scoreAndRank` runs (after `tagHistoricalEvent` in `transformWars()`), every row already carries its final `ConflictCategory` value from the retagging ticket — use that to filter per-category instead of with one global floor.

Replace `FAME_TIER_MIN_SITELINKS_WARS` with a per-`ConflictCategory` floor table (generalPublic/educated/specialist thresholds per category) using the numbers decided in the "Per-category sitelink fame-tier floors" ticket. `scoreAndRank`'s floor-filter-then-sort shape stays the same; it just needs to look up the row's category to pick which floor applies, then still keep the specialist (loosest) floor as the actual output cut per the existing "output is a superset covering all three tiers, zoom drives which tier is active client-side" reasoning (ADR 0002) — that reasoning is per-category now too.

Update `score.test.ts` for the new per-category table shape.

## Answer

Landed. `FAME_TIER_MIN_SITELINKS_WARS` replaced with `FAME_TIER_SITELINKS_WARS: Record<ConflictCategory, FameTierSitelinks>` — one `{ generalPublic, educated, specialist }` entry per surviving category, all 9 currently pointing at the same flat `{100, 90, 70}` object per "Per-category sitelink fame-tier floors"' Answer, generated via `CONFLICT_CATEGORIES.map(...)` rather than 9 hand-written duplicate literals so a future re-tuning of one category is a one-line change, not a restructure.

`scoreAndRank`'s signature widened to `<T extends { sitelinks: number; category?: ConflictCategory }>`, looking up each row's own `category` to pick its floor before the same filter-then-sort-descending shape as before. A row with `category: undefined` (an unmapped/dropped type QID) is dropped outright rather than falling back to some default floor — Output would drop it anyway via `write-datasets.ts`'s "no mappable event category" check, so there's no real floor to apply. `MIN_SITELINKS` in `fetch/queries/min-sitelinks.ts` already updated to 70 by "Split fetch into per-category queries", satisfying the "fetch floor <= every category's specialist floor" invariant this file's comment documents.

`score.test.ts` rewritten: rows now carry a `category`, new cases for "drops a row with no mappable category" and "applies each row's own category's floor," plus a `FAME_TIER_SITELINKS_WARS has one entry per ConflictCategory value` shape check. `npm run typecheck`/`test --workspace packages/data-pipeline` clean (109/109).
