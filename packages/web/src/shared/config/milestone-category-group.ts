import { m } from '../paraglide/messages.js';
import type { MilestoneCategoryGroup } from '../types';

// Mirrors design-tokens.md's Milestone Category Palette. Lives in
// shared/config, not widgets/timeline-canvas/options.ts, since both the
// Milestones lane (marker fill, via options.ts's derived
// MILESTONE_CATEGORY_COLORS) and the sidebar's Milestone Category Group
// pills (swatch) need it — a shared value, not D3-rendering-specific, same
// reasoning as occupation-domain-colors.ts's DOMAIN_COLORS.
export const MILESTONE_CATEGORY_GROUP_COLORS: Record<
  MilestoneCategoryGroup,
  string
> = {
  'science-innovation': '#008456',
  'social-culture': '#BC8118',
};

// Display labels for the sidebar's Milestone Category Group filter pills —
// design-tokens.md's Milestone Category Palette table names. Picked once at
// module load from the compiled locale's message catalog (docs/adr/0005) —
// same pattern as occupation-domain-colors.ts's DOMAIN_LABELS.
export const MILESTONE_CATEGORY_GROUP_LABELS: Record<
  MilestoneCategoryGroup,
  string
> = {
  'science-innovation':
    m['taxonomy.milestone-category-group.science-innovation'](),
  'social-culture': m['taxonomy.milestone-category-group.social-culture'](),
};
