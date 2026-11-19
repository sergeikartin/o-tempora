// Sitelinks measure breadth of coverage and pageviews measure reader interest.
// The benchmarks leave headroom above the highest sampled values (ADR 0010).
const SITELINKS_MAX = 350;
const PAGEVIEWS_MAX = 200_000_000;
const SITELINKS_WEIGHT = 0.6;
const PAGEVIEWS_WEIGHT = 0.4;

function logNormalize(value: number, max: number): number {
  return Math.min(100, (100 * Math.log(1 + value)) / Math.log(1 + max));
}

export function computeFameScore({
  sitelinks,
  pageviews,
}: {
  sitelinks: number;
  pageviews: number;
}): number {
  const sSitelinks = logNormalize(sitelinks, SITELINKS_MAX);
  const sPageviews = logNormalize(pageviews, PAGEVIEWS_MAX);
  return Math.round(
    SITELINKS_WEIGHT * sSitelinks + PAGEVIEWS_WEIGHT * sPageviews,
  );
}

export function rankByFameScore<
  T extends { sitelinks: number; pageviews: number },
>(rows: T[]): (T & { fameScore: number })[] {
  return rows
    .map((row) => ({ ...row, fameScore: computeFameScore(row) }))
    .sort((a, b) => b.fameScore - a.fameScore);
}

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
