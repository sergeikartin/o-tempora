import { MILESTONE_CATEGORY_GROUPS } from '../types';
import { m } from '../paraglide/messages.js';
import { CONFLICT_COLOR } from './conflict-color';
import { MILESTONE_CATEGORY_GROUP_COLORS, MILESTONE_CATEGORY_GROUP_LABELS } from './milestone-category-group';

// The sidebar's "Conflicts & Milestones" section is ONE multi-select
// filter, not two separate controls — mirrors Region/Occupation Domain's
// "one flat list of values, empty means unfiltered" shape exactly. The
// values folds a UI-only 'conflicts' sentinel (Conflicts carry no
// color-driving grouping of their own — see CONTEXT.md's Conflict Category
// entry — so the entire lane is just one more option in the list) together
// with the 2 real MilestoneCategoryGroup values. Revised 2026-08-12: an
// earlier version split this into a 3-pill Milestone Category Group filter
// plus a separately-styled Conflicts visibility toggle; folded into one
// list per feedback that the section should behave like every other
// multi-select filter in the sidebar.
export const CONFLICTS_MILESTONES_FILTER_VALUES = ['conflicts', ...MILESTONE_CATEGORY_GROUPS] as const;

export type ConflictsMilestonesFilterValue = (typeof CONFLICTS_MILESTONES_FILTER_VALUES)[number];

export const CONFLICTS_MILESTONES_FILTER_LABELS: Record<ConflictsMilestonesFilterValue, string> = {
  conflicts: m['taxonomy.conflicts-milestones-filter.conflicts'](),
  ...MILESTONE_CATEGORY_GROUP_LABELS,
};

// Each pill's swatch matches what's already on the timeline: CONFLICT_COLOR
// for the flat Conflicts fill, MILESTONE_CATEGORY_GROUP_COLORS for the 2
// Milestone groups — same "honest, truthful legend" principle as every
// other sidebar swatch.
export const CONFLICTS_MILESTONES_FILTER_COLORS: Record<ConflictsMilestonesFilterValue, string> = {
  conflicts: CONFLICT_COLOR,
  ...MILESTONE_CATEGORY_GROUP_COLORS,
};
