// Must match FAME_TIER_MIN_SITELINKS.specialist in transform/score.ts —
// fetching anything below this floor is wasted, since Score always
// discards it.
export const MIN_SITELINKS = 30;
