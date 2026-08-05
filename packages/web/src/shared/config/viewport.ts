export const ZOOM_MIN_YEARS = 10;
export const ZOOM_MAX_YEARS = 500;

export const DEFAULT_VIEWPORT_START = Temporal.PlainDate.from({ year: 1800, month: 1, day: 1 });
export const DEFAULT_VIEWPORT_END = Temporal.PlainDate.from({ year: 1900, month: 1, day: 1 });

export const PAN_MIN_DATE = Temporal.PlainDate.from({ year: -2750, month: 1, day: 1 });

// Zoom gates entity density automatically via three contiguous Fame Tiers,
// replacing the never-built manual fame-tier selector (Unit 9) outright —
// see packages/web/docs/adr/0002-fame-tier-drives-zoom.md. CORE/NOTABLE/
// EXHAUSTIVE are the UI's display names for the data-pipeline's
// generalPublic/educated/specialist tiers (packages/data-pipeline/src/
// transform/score.ts); the bands below are contiguous and span exactly
// [ZOOM_MIN_YEARS, ZOOM_MAX_YEARS].
export const FAME_TIER_NAMES = ['CORE', 'NOTABLE', 'EXHAUSTIVE'] as const;
export type FameTierName = (typeof FAME_TIER_NAMES)[number];

export interface FameTierYearBound {
  minYears: number;
  maxYears: number;
}

// Visible-years bounds each tier owns, keyed off the same pixelsPerYear
// mechanism that already clamps ZOOM_MIN_YEARS/ZOOM_MAX_YEARS — only the
// max of NOTABLE/EXHAUSTIVE are read directly (see options.ts's
// fameTierForVisibleYears); CORE/EXHAUSTIVE's outer bounds are implied by
// ZOOM_MAX_YEARS/ZOOM_MIN_YEARS and included here for documentation.
export const FAME_TIER_YEAR_BOUNDS: Record<FameTierName, FameTierYearBound> = {
  CORE: { minYears: 150, maxYears: ZOOM_MAX_YEARS },
  NOTABLE: { minYears: 50, maxYears: 150 },
  EXHAUSTIVE: { minYears: ZOOM_MIN_YEARS, maxYears: 50 },
};

// Duplicated (not imported) from packages/data-pipeline/src/transform/
// score.ts's FAME_TIER_MIN_HPI/FAME_TIER_MIN_SITELINKS_WARS/
// FAME_TIER_MIN_SITELINKS_DISCOVERIES — packages/web only depends on
// packages/shared-types, not packages/data-pipeline, so the values are
// mirrored here under the UI's CORE/NOTABLE/EXHAUSTIVE names rather than
// the pipeline's generalPublic/educated/specialist. Keep in sync with that
// file if the tier tables ever change.
export const FAME_TIER_MIN_HPI: Record<FameTierName, number> = {
  CORE: 90,
  NOTABLE: 85,
  EXHAUSTIVE: 75,
};

export const FAME_TIER_MIN_SITELINKS_WARS: Record<FameTierName, number> = {
  CORE: 100,
  NOTABLE: 50,
  EXHAUSTIVE: 30,
};

export const FAME_TIER_MIN_SITELINKS_DISCOVERIES: Record<FameTierName, number> = {
  CORE: 200,
  NOTABLE: 100,
  EXHAUSTIVE: 50,
};
