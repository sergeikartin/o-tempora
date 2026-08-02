// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. This is a one-line sort by
// sitelinks descending plus a slice to the fame-tier ceiling; the "more"
// tier caps at 750 (per spec), applied independently per lane (people; and
// historical events + inventions combined into one ranked pool).
export const FAME_TIER_CEILING = 750;

export function scoreAndRank<T extends { sitelinks: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.sitelinks - a.sitelinks).slice(0, FAME_TIER_CEILING);
}
