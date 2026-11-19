import { m } from '../paraglide/messages.js';
import { MILESTONE_CATEGORY_GROUPS } from '../types';
import { CONFLICT_COLOR } from './conflict-color';
import {
  MILESTONE_CATEGORY_GROUP_COLORS,
  MILESTONE_CATEGORY_GROUP_LABELS,
} from './milestone-category-group';

// The Conflicts option is a UI sentinel because the filter toggles the whole lane.
export const CONFLICTS_MILESTONES_FILTER_VALUES = [
  'conflicts',
  ...MILESTONE_CATEGORY_GROUPS,
] as const;

export type ConflictsMilestonesFilterValue =
  (typeof CONFLICTS_MILESTONES_FILTER_VALUES)[number];

export const CONFLICTS_MILESTONES_FILTER_LABELS: Record<
  ConflictsMilestonesFilterValue,
  string
> = {
  conflicts: m['taxonomy.conflicts-milestones-filter.conflicts'](),
  ...MILESTONE_CATEGORY_GROUP_LABELS,
};

export const CONFLICTS_MILESTONES_FILTER_COLORS: Record<
  ConflictsMilestonesFilterValue,
  string
> = {
  conflicts: CONFLICT_COLOR,
  ...MILESTONE_CATEGORY_GROUP_COLORS,
};
