export const ZOOM_MIN_YEARS = 10;
export const ZOOM_MAX_YEARS = 500;

export const DEFAULT_VIEWPORT_START = Temporal.PlainDate.from({ year: 1800, month: 1, day: 1 });
export const DEFAULT_VIEWPORT_END = Temporal.PlainDate.from({ year: 1900, month: 1, day: 1 });

export const PAN_MIN_DATE = Temporal.PlainDate.from({ year: -2750, month: 1, day: 1 });

// Sidebar Fame-floor filters: a raw `fameScore` numeric floor per lane, set
// directly by the user (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md
// — supersedes the zoom-coupled Fame Tier system, ADR 0002). Bounds mirror
// each lane's real fameScore range (People: Pantheon HPI 75-100; Wars &
// Discoveries: Wikidata sitelinks). Zoom no longer affects entity density —
// see shared/config/occupation-domain-colors.ts's sibling comment for why
// this config lives here rather than under widgets/timeline-canvas: the
// sidebar filter feature needs it too.
export const FAME_SCORE_LANES = ['people', 'wars', 'discoveries'] as const;
export type FameScoreLane = (typeof FAME_SCORE_LANES)[number];

export interface FameScoreBounds {
  min: number;
  max: number;
  default: number;
}

// wars/discoveries fameScore is no longer a raw sitelink count — ADR 0010
// (packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-
// wars-discoveries-fame-score.md) blends sitelinks with Wikimedia pageviews
// into one shared 0-100 log-normalized scale, so both lanes now share the
// same bounds instead of lane-specific raw-count ranges. 1-100/default-75
// is a provisional starting point (the ADR's documented consequence),
// pending a manual re-tune once real blended scores are visible in the
// running app.
export const FAME_SCORE_BOUNDS: Record<FameScoreLane, FameScoreBounds> = {
  people: { min: 75, max: 100, default: 85 },
  wars: { min: 1, max: 100, default: 75 },
  discoveries: { min: 1, max: 100, default: 75 },
};
