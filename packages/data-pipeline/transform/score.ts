// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Three named tiers, expressed
// as sitelink floors shared across both lanes (people; and historical events
// + inventions combined): each tier is a `fameScore >=` cutoff on the same
// field, so general-public is a subset of educated is a subset of specialist
// automatically — no re-ranking needed when the tier changes.
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
