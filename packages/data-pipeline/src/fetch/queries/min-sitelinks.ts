// Flat fetch floor across all 9 ConflictCategory values — must match the
// flat `specialist` floor in transform/score.ts's per-category
// FAME_TIER_SITELINKS_WARS table (currently 70, same as this) — fetching
// anything below this floor is wasted, since Score always discards it. See
// .scratch/wars-conflicts-taxonomy/issues/01-per-category-sitelink-floors.md's
// Answer for why this is flat rather than tuned per category.
export const MIN_SITELINKS = 70;
