import type { MilestoneCategoryGroup } from '../types';
import { LANG } from '../i18n';

// Mirrors design-tokens.md's Milestone Category Palette. Lives in
// shared/config, not widgets/timeline-canvas/options.ts, since both the
// Milestones lane (marker fill, via options.ts's derived
// MILESTONE_CATEGORY_COLORS) and the sidebar's Milestone Category Group
// pills (swatch) need it — a shared value, not D3-rendering-specific, same
// reasoning as occupation-domain-colors.ts's DOMAIN_COLORS.
export const MILESTONE_CATEGORY_GROUP_COLORS: Record<MilestoneCategoryGroup, string> = {
  'science-innovation': '#008456',
  'social-culture': '#BC8118',
};

// Display labels for the sidebar's Milestone Category Group filter pills —
// design-tokens.md's Milestone Category Palette table names. Bilingual,
// picked once at module load by the build-time LANG flag (shared/i18n) —
// same pattern as occupation-domain-colors.ts's DOMAIN_LABELS.
const MILESTONE_CATEGORY_GROUP_LABELS_EN: Record<MilestoneCategoryGroup, string> = {
  'science-innovation': 'Science & Innovation',
  'social-culture': 'Social & Human Culture',
};

const MILESTONE_CATEGORY_GROUP_LABELS_RU: Record<MilestoneCategoryGroup, string> = {
  'science-innovation': 'Наука и инновации',
  'social-culture': 'Общество и культура',
};

export const MILESTONE_CATEGORY_GROUP_LABELS: Record<MilestoneCategoryGroup, string> =
  LANG === 'ru' ? MILESTONE_CATEGORY_GROUP_LABELS_RU : MILESTONE_CATEGORY_GROUP_LABELS_EN;
