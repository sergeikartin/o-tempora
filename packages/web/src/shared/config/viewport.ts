import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
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
// running app. `default` per lane reuses DETAIL_LEVEL_FAME_SCORE_FLOORS'
// level 2 (Mainstream) entry rather than repeating the same three numbers a
// third time.
export const FAME_SCORE_BOUNDS: Record<FameScoreLane, FameScoreBounds> = {
  people: {
    min: 75,
    max: 100,
    default: DETAIL_LEVEL_FAME_SCORE_FLOORS.people[1],
  },
  conflicts: {
    min: 1,
    max: 100,
    default: DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts[1],
  },
  milestones: {
    min: 1,
    max: 100,
    default: DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones[1],
  },
};

// Detail Level: a 4-position UI preset that writes canonical values into the
// three fame-score floor inputs above in one click, and is also the
// pipeline's network-loading boundary (CONTEXT.md's Detail Level,
// docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md).
// `mainstream` (level 2) deliberately equals FAME_SCORE_BOUNDS's existing
// per-lane defaults, so the app's launch behavior is unchanged; each level
// after it digs deeper (lower floor, more entries) rather than narrower.
export type DetailLevelId =
  | 'legendary'
  | 'mainstream'
  | 'specialized'
  | 'deep-cut';

export interface DetailLevel {
  id: DetailLevelId;
  label: string;
  description: string;
  values: Record<FameScoreLane, number>;
}

function detailLevel(
  id: DetailLevelId,
  label: string,
  description: string,
  index: 0 | 1 | 2 | 3,
): DetailLevel {
  return {
    id,
    label,
    description,
    values: {
      people: DETAIL_LEVEL_FAME_SCORE_FLOORS.people[index],
      conflicts: DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts[index],
      milestones: DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones[index],
    },
  };
}

// Labels/descriptions picked once at module load from the compiled locale's
// message catalog (docs/adr/0005) — same pattern as shared/config's other
// taxonomy labels (e.g. occupation-domain-colors.ts's DOMAIN_LABELS).
export const DETAIL_LEVELS: readonly [
  DetailLevel,
  DetailLevel,
  DetailLevel,
  DetailLevel,
] = [
  detailLevel(
    'legendary',
    m['taxonomy.detail-level.legendary'](),
    m['detailLevelDescription.legendary'](),
    0,
  ),
  detailLevel(
    'mainstream',
    m['taxonomy.detail-level.mainstream'](),
    m['detailLevelDescription.mainstream'](),
    1,
  ),
  detailLevel(
    'specialized',
    m['taxonomy.detail-level.specialized'](),
    m['detailLevelDescription.specialized'](),
    2,
  ),
  detailLevel(
    'deep-cut',
    m['taxonomy.detail-level.deep-cut'](),
    m['detailLevelDescription.deep-cut'](),
    3,
  ),
];

export const DEFAULT_DETAIL_LEVEL: DetailLevel = DETAIL_LEVELS[1];
