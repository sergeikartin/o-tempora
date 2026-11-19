import { m } from '../paraglide/messages.js';
import type { MilestoneCategoryGroup } from '../types';

// Mirrors design-tokens.md's Milestone Category Palette. Lives in
// shared/config because both the Milestones lane (via options.ts's
// MILESTONE_CATEGORY_COLORS) and the Filters Panel pills (swatch) need it.
export const MILESTONE_CATEGORY_GROUP_COLORS: Record<
  MilestoneCategoryGroup,
  string
> = {
  'science-innovation': '#008255',
  'social-culture': '#946513',
};

export const MILESTONE_CATEGORY_GROUP_LABELS: Record<
  MilestoneCategoryGroup,
  string
> = {
  'science-innovation':
    m['taxonomy.milestone-category-group.science-innovation'](),
  'social-culture': m['taxonomy.milestone-category-group.social-culture'](),
};
