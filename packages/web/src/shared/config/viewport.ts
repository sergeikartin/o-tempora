export const ZOOM_MIN_YEARS = 10;
export const ZOOM_MAX_YEARS = 500;

export const DEFAULT_VIEWPORT_START = Temporal.PlainDate.from({ year: 1800, month: 1, day: 1 });
export const DEFAULT_VIEWPORT_END = Temporal.PlainDate.from({ year: 1900, month: 1, day: 1 });

export const PAN_MIN_DATE = Temporal.PlainDate.from({ year: -2750, month: 1, day: 1 });

// Sidebar Fame-floor filters: a raw `fameScore` numeric floor per lane, set
// directly by the user (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md
// — supersedes the zoom-coupled Fame Tier system, ADR 0002). Bounds mirror
// each lane's real fameScore range (People: Pantheon HPI 75-100; Wars &
// Discoveries: Wikidata sitelinks); defaults match the old CORE tier's
// values so first paint is unchanged. Zoom no longer affects entity density
// — see shared/config/occupation-domain-colors.ts's sibling comment for why
// this config lives here rather than under widgets/timeline-canvas: the
// sidebar filter feature needs it too.
export const FAME_SCORE_LANES = ['people', 'wars', 'discoveries'] as const;
export type FameScoreLane = (typeof FAME_SCORE_LANES)[number];

export interface FameScoreBounds {
  min: number;
  max: number;
  default: number;
}

export const FAME_SCORE_BOUNDS: Record<FameScoreLane, FameScoreBounds> = {
  people: { min: 75, max: 100, default: 90 },
  wars: { min: 30, max: 193, default: 100 },
  discoveries: { min: 50, max: 386, default: 200 },
};
