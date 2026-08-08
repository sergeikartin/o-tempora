import type { ConflictCategory } from "@same-sky/shared-types";
import { CONFLICT_CATEGORIES } from "@same-sky/shared-types";

// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Named tiers are expressed as
// sitelink floors, one table per ConflictCategory rather than one shared
// table — see MIN_SITELINKS in fetch/queries/min-sitelinks.ts, which must
// stay <= every category's `specialist` floor here since fetching below
// that floor is wasted. Each tier is a `fameScore >=` cutoff on the same
// field, so general-public is a subset of educated is a subset of
// specialist automatically, per category. Flat 70/90/100 across every
// category, not tuned per category — see
// .scratch/wars-conflicts-taxonomy/issues/01-per-category-sitelink-floors.md's
// Answer for why: population-size differences between categories are real
// signal about how much notable material Wikidata holds for each event
// type, not something to correct for by loosening thin categories' floors.
// Kept as a per-category table (not a single flat constant) so a future
// re-tuning of one category doesn't require re-deriving this shape. (People
// uses FAME_TIER_MIN_HPI instead, since it's no longer Wikidata-sourced;
// Discoveries has no tier table at all — see rankDiscoveriesBySitelinks
// below.)
export interface FameTierSitelinks {
  generalPublic: number;
  educated: number;
  specialist: number;
}

// A fresh object per category (not a shared reference) — a per-category
// re-tuning is expected to write `FAME_TIER_SITELINKS_WARS['some-category'].specialist = ...`
// directly, which would silently retune every category at once if they all
// pointed at the same object.
export const FAME_TIER_SITELINKS_WARS: Record<ConflictCategory, FameTierSitelinks> = Object.fromEntries(
  CONFLICT_CATEGORIES.map((category) => [category, { generalPublic: 100, educated: 90, specialist: 70 }]),
) as Record<ConflictCategory, FameTierSitelinks>;

// Floor is each row's own category's specialist tier (the loosest tier,
// largest volume) rather than generalPublic: zoom itself now drives the
// active Fame Tier client-side (packages/web/docs/adr/0002-fame-tier-drives-zoom.md),
// so the pipeline output needs to already be a superset covering all three
// tiers, not just the tightest one — that reasoning is per-category now
// too. A row with no mappable category (an unmapped/dropped type QID) is
// dropped here rather than falling back to some default floor — Output
// would drop it anyway (write-datasets.ts's "no mappable event category"
// check), so there's no per-category floor to apply in the first place.
export function scoreAndRank<T extends { sitelinks: number; category?: ConflictCategory }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.category !== undefined && row.sitelinks >= FAME_TIER_SITELINKS_WARS[row.category].specialist)
    .sort((a, b) => b.sitelinks - a.sitelinks);
}

// Discoveries has no specialist-floor filter, unlike scoreAndRank — its
// source is the ~121-item hand-curated list (data/raw/events-curated.raw.json),
// not a huge raw Wikidata corpus that needs floor-filtering down to a
// manageable size, so every row that clears Output's enrichment-failure
// drop (write-datasets.ts's buildDiscoveries) is kept; the sidebar's
// user-facing fame-score floor (FAME_SCORE_BOUNDS.discoveries) is this
// lane's only density control (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md).
export function rankDiscoveriesBySitelinks<T extends { sitelinks: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.sitelinks - a.sitelinks);
}

// People-lane fame tiers, bound to Pantheon's HPI (0-100 scale) instead of
// Wikidata sitelinks — independent of FAME_TIER_MIN_SITELINKS, which stays
// in effect for Wars/Discoveries. Confirmed against the real 2025 dataset:
// hpi>=90 -> 108 people, hpi>=85 -> 423, hpi>=75 -> 3,840 (out of 126,582),
// the same tightly-nested-tiers property FAME_TIER_MIN_SITELINKS relies on
// (.scratch/alt-data-sources/issues/03-fame-tier-hpi-thresholds.md).
export const FAME_TIER_MIN_HPI = {
  generalPublic: 90,
  educated: 85,
  specialist: 75,
} as const;

// Same specialist floor as scoreAndRank, for the same reason.
export function scoreAndRankByHpi<T extends { hpi: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.hpi >= FAME_TIER_MIN_HPI.specialist)
    .sort((a, b) => b.hpi - a.hpi);
}
