// Fame score is the sitelink count, unmodified — no normalization, no
// log-scaling, no blending with other signals. Named tiers are expressed as
// sitelink floors, one table per lane: Discoveries & Inventions fame scores
// run far higher than Wars & Conflicts (max ~386 vs. ~193 in the published
// data), so a shared floor left Discoveries much denser than Wars at the
// same nominal tier name — see MIN_SITELINKS in
// fetch/queries/min-sitelinks.ts, which must stay <= the lowest `specialist`
// floor across both tables (currently Wars', at 30) since fetching below
// that floor is wasted. Within a table, each tier is a `fameScore >=`
// cutoff on the same field, so general-public is a subset of educated is a
// subset of specialist automatically — no re-ranking needed when the tier
// changes. (People uses FAME_TIER_MIN_HPI instead, since it's no longer
// Wikidata-sourced.)
export const FAME_TIER_MIN_SITELINKS_WARS = {
  generalPublic: 100,
  educated: 50,
  specialist: 30,
} as const;

export const FAME_TIER_MIN_SITELINKS_DISCOVERIES = {
  generalPublic: 200,
  educated: 100,
  specialist: 50,
} as const;

export type FameTier = keyof typeof FAME_TIER_MIN_SITELINKS_WARS;

function filterAndRankBySitelinks<T extends { sitelinks: number }>(rows: T[], floor: number): T[] {
  return rows.filter((row) => row.sitelinks >= floor).sort((a, b) => b.sitelinks - a.sitelinks);
}

// Floor is generalPublic (the lowest tier by volume, not lowest by number)
// rather than specialist: with no frontend tier selector built yet (Unit 9,
// unspecced — see docs/active-context.md), the pipeline output IS what
// renders, so it needs to already be down to a browsable count.
export function scoreAndRank<T extends { sitelinks: number }>(rows: T[]): T[] {
  return filterAndRankBySitelinks(rows, FAME_TIER_MIN_SITELINKS_WARS.generalPublic);
}

// Same generalPublic-floor reasoning as scoreAndRank, using Discoveries'
// own (higher) tier table.
export function scoreAndRankDiscoveries<T extends { sitelinks: number }>(rows: T[]): T[] {
  return filterAndRankBySitelinks(rows, FAME_TIER_MIN_SITELINKS_DISCOVERIES.generalPublic);
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

// Same generalPublic floor as scoreAndRank, for the same reason.
export function scoreAndRankByHpi<T extends { hpi: number }>(rows: T[]): T[] {
  return rows
    .filter((row) => row.hpi >= FAME_TIER_MIN_HPI.generalPublic)
    .sort((a, b) => b.hpi - a.hpi);
}
