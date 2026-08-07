// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Named tiers are expressed as
// sitelink floors — see MIN_SITELINKS in fetch/queries/min-sitelinks.ts,
// which must stay <= this table's `specialist` floor (30) since fetching
// below that floor is wasted. Each tier is a `fameScore >=` cutoff on the
// same field, so general-public is a subset of educated is a subset of
// specialist automatically. (People uses FAME_TIER_MIN_HPI instead, since
// it's no longer Wikidata-sourced; Discoveries has no tier table at all —
// see rankDiscoveriesBySitelinks below.)
export const FAME_TIER_MIN_SITELINKS_WARS = {
  generalPublic: 100,
  educated: 50,
  specialist: 30,
} as const;

export type FameTier = keyof typeof FAME_TIER_MIN_SITELINKS_WARS;

function filterAndRankBySitelinks<T extends { sitelinks: number }>(rows: T[], floor: number): T[] {
  return rows.filter((row) => row.sitelinks >= floor).sort((a, b) => b.sitelinks - a.sitelinks);
}

// Floor is specialist (the loosest tier, largest volume) rather than
// generalPublic: zoom itself now drives the active Fame Tier client-side
// (packages/web/docs/adr/0002-fame-tier-drives-zoom.md), so the pipeline
// output needs to already be a superset covering all three tiers, not just
// the tightest one.
export function scoreAndRank<T extends { sitelinks: number }>(rows: T[]): T[] {
  return filterAndRankBySitelinks(rows, FAME_TIER_MIN_SITELINKS_WARS.specialist);
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
