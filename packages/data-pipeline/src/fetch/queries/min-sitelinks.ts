// Must match the lowest `specialist` floor across transform/score.ts's
// per-lane tier tables (currently FAME_TIER_MIN_SITELINKS_WARS', at 30) —
// fetching anything below this floor is wasted, since Score always
// discards it.
export const MIN_SITELINKS = 30;
