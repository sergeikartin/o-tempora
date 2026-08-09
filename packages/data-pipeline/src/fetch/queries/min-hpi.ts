// Must match FAME_TIER_MIN_HPI.specialist in transform/score.ts — fetching
// a description for anything below this floor is wasted, since Score
// always discards it. Defined here (not imported from transform/) to keep
// Fetch from depending on Transform.
export const MIN_HPI = 75;
