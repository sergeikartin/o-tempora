// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. This is a one-line sort by
// sitelinks descending plus a slice to the fame-tier ceiling — applied
// independently per lane (people; and historical events + inventions
// combined into one ranked pool), with different ceilings per lane since
// the two candidate pools are very different sizes.
export const PEOPLE_FAME_TIER_CEILING = 3000;
export const EVENTS_FAME_TIER_CEILING = 1000;

export function scoreAndRank<T extends { sitelinks: number }>(rows: T[], ceiling: number): T[] {
  return [...rows].sort((a, b) => b.sitelinks - a.sitelinks).slice(0, ceiling);
}
