import { LANG } from '../i18n';

export const ZOOM_MIN_YEARS = 10;
export const ZOOM_MAX_YEARS = 500;

export const DEFAULT_VIEWPORT_START = Temporal.PlainDate.from({ year: 1740, month: 1, day: 1 });
export const DEFAULT_VIEWPORT_END = Temporal.PlainDate.from({ year: 1860, month: 1, day: 1 });

export const PAN_MIN_DATE = Temporal.PlainDate.from({ year: -801, month: 1, day: 1 });

// Sidebar Fame-floor filters: a raw `fameScore` numeric floor per lane, set
// directly by the user (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md
// — supersedes the zoom-coupled Fame Tier system, ADR 0002). Bounds mirror
// each lane's real fameScore range (People: Pantheon HPI 75-100; Conflicts &
// Milestones: Wikidata sitelinks). Zoom no longer affects entity density —
// see shared/config/occupation-domain-colors.ts's sibling comment for why
// this config lives here rather than under widgets/timeline-canvas: the
// sidebar filter feature needs it too.
export const FAME_SCORE_LANES = ['people', 'conflicts', 'milestones'] as const;
export type FameScoreLane = (typeof FAME_SCORE_LANES)[number];

export interface FameScoreBounds {
  min: number;
  max: number;
  default: number;
}

// conflicts/milestones fameScore is no longer a raw sitelink count — ADR 0010
// (packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-
// wars-discoveries-fame-score.md) blends sitelinks with Wikimedia pageviews
// into one shared 0-100 log-normalized scale, so both lanes now share the
// same bounds instead of lane-specific raw-count ranges. 1-100/default-82
// is a provisional starting point (the ADR's documented consequence),
// pending a manual re-tune once real blended scores are visible in the
// running app.
export const FAME_SCORE_BOUNDS: Record<FameScoreLane, FameScoreBounds> = {
  people: { min: 75, max: 100, default: 90 },
  conflicts: { min: 1, max: 100, default: 82 },
  milestones: { min: 1, max: 100, default: 82 },
};

// Data Depth: a three-position UI preset that writes canonical values into
// the three fame-score floor inputs above in one click (grill-with-docs
// session 2026-08-12 — see CONTEXT.md's Data Depth entry). `curated`
// deliberately equals FAME_SCORE_BOUNDS's existing per-lane defaults, so
// the app's launch behavior is unchanged by this feature; each level after
// it digs deeper (lower floor, more entries) rather than narrower. Purely a
// UI convenience — distinct from the retired pipeline-side Fame Tier
// gating (ADR 0003).
export type DataDepthLevelId = 'curated' | 'expanded' | 'full';

export interface DataDepthLevel {
  id: DataDepthLevelId;
  label: string;
  values: Record<FameScoreLane, number>;
}

// Bilingual labels, picked once at module load by the build-time LANG flag
// (shared/i18n) — same pattern as shared/config's other taxonomy labels
// (e.g. occupation-domain-colors.ts's DOMAIN_LABELS).
const DATA_DEPTH_LABELS: Record<DataDepthLevelId, string> =
  LANG === 'ru'
    ? { curated: 'Куратор', expanded: 'Расширенный', full: 'Полный' }
    : { curated: 'Curated', expanded: 'Expanded', full: 'Full' };

export const DATA_DEPTH_LEVELS: DataDepthLevel[] = [
  { id: 'curated', label: DATA_DEPTH_LABELS.curated, values: { people: 90, conflicts: 82, milestones: 82 } },
  { id: 'expanded', label: DATA_DEPTH_LABELS.expanded, values: { people: 85, conflicts: 70, milestones: 70 } },
  { id: 'full', label: DATA_DEPTH_LABELS.full, values: { people: 80, conflicts: 1, milestones: 1 } },
];

// Derives which level (if any) the given fame-score floor values match —
// used only to drive the switch's highlighted state, never stored as its
// own piece of state. Returns null ("custom") once a numeric input has
// been hand-edited away from every preset row.
export function matchDataDepthLevel(values: Record<FameScoreLane, number>): DataDepthLevelId | null {
  const match = DATA_DEPTH_LEVELS.find((level) => FAME_SCORE_LANES.every((lane) => level.values[lane] === values[lane]));
  return match ? match.id : null;
}
