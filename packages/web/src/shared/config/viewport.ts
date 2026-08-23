import { TIER_0_FAME_SCORE_FLOOR } from '@same-sky/shared-types';
import { m } from '../paraglide/messages.js';

export const ZOOM_MIN_YEARS = 50;
export const ZOOM_MAX_YEARS = 250;

export const DEFAULT_VIEWPORT_START_YEAR = 1740;
export const DEFAULT_VIEWPORT_END_YEAR = 1860;

export const PAN_MIN_YEAR = -801;

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
// running app. `default` per lane reuses TIER_0_FAME_SCORE_FLOOR (shared
// with data-pipeline's Output stage, docs/adr/0004-payload-tier-split-
// defers-low-fame-data.md) rather than repeating the same three numbers a
// third time — Mainstream's launch behavior and Payload Tier's loading
// boundary are independent mechanisms that happen to want the same floor.
export const FAME_SCORE_BOUNDS: Record<FameScoreLane, FameScoreBounds> = {
  people: { min: 75, max: 100, default: TIER_0_FAME_SCORE_FLOOR.people },
  conflicts: { min: 1, max: 100, default: TIER_0_FAME_SCORE_FLOOR.conflicts },
  milestones: {
    min: 1,
    max: 100,
    default: TIER_0_FAME_SCORE_FLOOR.milestones,
  },
};

// Data Depth: a two-position UI preset that writes canonical values into
// the three fame-score floor inputs above in one click (grill-with-docs
// session 2026-08-18 — see CONTEXT.md's Data Depth entry). `mainstream`
// deliberately equals FAME_SCORE_BOUNDS's existing per-lane defaults, so
// the app's launch behavior is unchanged by this feature; `deep-cut` digs
// deeper (lower floor, more entries) rather than narrower. Purely a UI
// convenience — distinct from the retired pipeline-side Fame Tier gating
// (ADR 0003), and from the unrelated Payload Tier loading split above,
// despite sharing these same numbers (CONTEXT.md's Payload Tier entry).
export type DataDepthLevelId = 'mainstream' | 'deep-cut';

export interface DataDepthLevel {
  id: DataDepthLevelId;
  label: string;
  values: Record<FameScoreLane, number>;
}

// Picked once at module load from the compiled locale's message catalog
// (docs/adr/0005) — same pattern as shared/config's other taxonomy labels
// (e.g. occupation-domain-colors.ts's DOMAIN_LABELS).
const DATA_DEPTH_LABELS: Record<DataDepthLevelId, string> = {
  mainstream: m['taxonomy.data-depth.mainstream'](),
  'deep-cut': m['taxonomy.data-depth.deep-cut'](),
};

export const DATA_DEPTH_LEVELS: DataDepthLevel[] = [
  {
    id: 'mainstream',
    label: DATA_DEPTH_LABELS.mainstream,
    values: { ...TIER_0_FAME_SCORE_FLOOR },
  },
  {
    id: 'deep-cut',
    label: DATA_DEPTH_LABELS['deep-cut'],
    values: { people: 80, conflicts: 64, milestones: 55 },
  },
];

// Derives which level (if any) the given fame-score floor values match —
// used only to drive the switch's highlighted state, never stored as its
// own piece of state. Returns null ("custom") once a numeric input has
// been hand-edited away from every preset row.
export function matchDataDepthLevel(
  values: Record<FameScoreLane, number>,
): DataDepthLevelId | null {
  const match = DATA_DEPTH_LEVELS.find((level) =>
    FAME_SCORE_LANES.every((lane) => level.values[lane] === values[lane]),
  );
  return match ? match.id : null;
}
