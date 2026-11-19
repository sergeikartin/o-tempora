import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
import { m } from '../paraglide/messages.js';

export const ZOOM_MIN_YEARS = 50;
export const ZOOM_MAX_YEARS = 250;

export const DEFAULT_VIEWPORT_START_YEAR = 1740;
export const DEFAULT_VIEWPORT_END_YEAR = 1860;

export const PAN_MIN_YEAR = -801;

// The desktop detail drawer's width (DetailPanel.module.css's .panel); an
// Entity Link's arrival fit leaves this much of the canvas out of its math.
export const DETAIL_DRAWER_WIDTH_PX = 440;

export const FAME_SCORE_LANES = ['people', 'conflicts', 'milestones'] as const;
export type FameScoreLane = (typeof FAME_SCORE_LANES)[number];

export interface FameScoreBounds {
  min: number;
  max: number;
  default: number;
}

// People use Pantheon HPI (75-100); Conflicts and Milestones share one
// 0-100 blended sitelinks/pageviews scale
// (packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md).
// `default` is DETAIL_LEVEL_FAME_SCORE_FLOORS' level 2 (Mainstream) entry.
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

// Detail Level: a 4-position preset that sets all three fame-score floors at
// once and is also the pipeline's network-loading boundary (GLOSSARY.md's
// Detail Level, docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md).
// `mainstream` (level 2) equals FAME_SCORE_BOUNDS's per-lane defaults; each
// later level has lower floors and more entries.
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
