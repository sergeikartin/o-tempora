import type { MilestoneCategoryGroup } from '../types';

// Mirrors design-tokens.md's Milestone Category Palette. Lives in
// shared/config, not widgets/timeline-canvas/options.ts, since both the
// Milestones lane (marker fill, via options.ts's derived
// MILESTONE_CATEGORY_COLORS) and the sidebar's Milestone Category Group
// pills (swatch) need it — a shared value, not D3-rendering-specific, same
// reasoning as occupation-domain-colors.ts's DOMAIN_COLORS.
export const MILESTONE_CATEGORY_GROUP_COLORS: Record<MilestoneCategoryGroup, string> = {
  'knowledge-culture': '#4B4597',
  'technology-industry': '#008456',
  'society-governance': '#BC8118',
};

// Display labels for the sidebar's Milestone Category Group filter pills —
// design-tokens.md's Milestone Category Palette table names.
export const MILESTONE_CATEGORY_GROUP_LABELS: Record<MilestoneCategoryGroup, string> = {
  'knowledge-culture': 'Knowledge & Culture',
  'technology-industry': 'Technology & Industry',
  'society-governance': 'Society & Governance',
};
