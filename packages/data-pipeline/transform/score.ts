// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Three named tiers, expressed
// as sitelink floors shared across the Wars & Conflicts and Discoveries &
// Inventions lanes (People uses FAME_TIER_MIN_HPI instead, since it's no
// longer Wikidata-sourced): each tier is a `fameScore >=` cutoff on the
// same field, so general-public is a subset of educated is a subset of
// specialist automatically — no re-ranking needed when the tier changes.
export const FAME_TIER_MIN_SITELINKS = {
  generalPublic: 100,
  educated: 50,
  specialist: 30,
} as const;

export type FameTier = keyof typeof FAME_TIER_MIN_SITELINKS;

export function scoreAndRank<T extends { sitelinks: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS.specialist)
    .sort((a, b) => b.sitelinks - a.sitelinks);
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

export function scoreAndRankByHpi<T extends { hpi: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.hpi >= FAME_TIER_MIN_HPI.specialist)
    .sort((a, b) => b.hpi - a.hpi);
}
