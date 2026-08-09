// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Shared by Wars and
// Discoveries, both hand-curated lists that are already vetted for
// relevance — unlike the old per-`ConflictCategory` sitelink-floor table
// this replaced (see .scratch/wars-curated-source/spec.md), a curated list
// needs no floor-filtering down to a manageable size; every row that clears
// Output's enrichment-failure drop (write-datasets.ts's buildWars/
// buildDiscoveries) is kept. Density control for both lanes is the
// sidebar's user-facing fame-score floor instead
// (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md).
export function rankBySitelinks<T extends { sitelinks: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.sitelinks - a.sitelinks);
}

// People-lane fame tiers, bound to Pantheon's HPI (0-100 scale) instead of
// Wikidata sitelinks — independent of rankBySitelinks above, which stays in
// effect for Wars/Discoveries. Confirmed against the real 2025 dataset:
// hpi>=90 -> 108 people, hpi>=85 -> 423, hpi>=75 -> 3,840 (out of 126,582)
// (.scratch/alt-data-sources/issues/03-fame-tier-hpi-thresholds.md).
export const FAME_TIER_MIN_HPI = {
  generalPublic: 90,
  educated: 85,
  specialist: 75,
} as const;

// Same specialist-floor shape as the old per-category Wars tier table this
// module used to carry — People just has one flat floor, not a per-category
// table.
export function scoreAndRankByHpi<T extends { hpi: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.hpi >= FAME_TIER_MIN_HPI.specialist)
    .sort((a, b) => b.hpi - a.hpi);
}
