// Fame score for Conflicts & Milestones: a log-normalized blend of Wikidata
// sitelinks (breadth of documentation) and Wikimedia pageviews (sustained
// reader interest), per docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md.
// No floor-filtering: the curated list is hand-vetted, so every row that clears
// Output's enrichment-failure drop (write-datasets.ts's buildConflicts/
// buildMilestones) is kept. Density is controlled by the user-facing fame-score
// floor (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md).
//
// Constants (ADR 0010's "Benchmark derivation"):
// - SITELINKS_MAX = 350: real curated-list max (296, "Internet"/"Computer") + headroom.
// - PAGEVIEWS_MAX = 200_000_000: WWII's trailing-4-year 7-language pageviews
//   total (143,235,719) from the ADR's 18-entity pilot, + headroom.
// - SITELINKS_WEIGHT = 0.60, PAGEVIEWS_WEIGHT = 0.40.
// - `pageviews` is the sum across the fixed 7-language basket (en/zh/es/fr/de/ar/ru)
//   over the trailing 4 full calendar years, computed upstream by
//   fetch-pageviews.ts.
const SITELINKS_MAX = 350;
const PAGEVIEWS_MAX = 200_000_000;
const SITELINKS_WEIGHT = 0.6;
const PAGEVIEWS_WEIGHT = 0.4;

function logNormalize(value: number, max: number): number {
  return Math.min(100, (100 * Math.log(1 + value)) / Math.log(1 + max));
}

export function computeFameScore({ sitelinks, pageviews }: { sitelinks: number; pageviews: number }): number {
  const sSitelinks = logNormalize(sitelinks, SITELINKS_MAX);
  const sPageviews = logNormalize(pageviews, PAGEVIEWS_MAX);
  return Math.round(SITELINKS_WEIGHT * sSitelinks + PAGEVIEWS_WEIGHT * sPageviews);
}

export function rankByFameScore<T extends { sitelinks: number; pageviews: number }>(
  rows: T[],
): (T & { fameScore: number })[] {
  return rows
    .map((row) => ({ ...row, fameScore: computeFameScore(row) }))
    .sort((a, b) => b.fameScore - a.fameScore);
}

// People-lane HPI floors (Pantheon's 0-100 scale), independent of the
// sitelinks/pageviews blend above. Against the 2025 dataset: hpi>=90 -> 108
// people, hpi>=85 -> 423, hpi>=75 -> 3,840 (of 126,582).
export const FAME_TIER_MIN_HPI = {
  generalPublic: 90,
  educated: 85,
  specialist: 75,
} as const;

// People keep only the `specialist` floor and rank by HPI.
export function scoreAndRankByHpi<T extends { hpi: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.hpi >= FAME_TIER_MIN_HPI.specialist)
    .sort((a, b) => b.hpi - a.hpi);
}
