import type { OccupationDomain } from '../types';

// Mirrors design-tokens.md's Occupation Domain Palette. Inlined because Unit
// 5 hasn't wired those tokens as CSS custom properties yet (ticket 05,
// blocked on Unit 5's still-open decisions) — swap for `var(--color-domain-*)`
// once it lands. Lives in shared/config, not widgets/timeline-canvas/options.ts,
// since both the People lane (bar fill) and the sidebar Legend (pill swatch)
// need it — a shared value, not D3-rendering-specific.
export const DOMAIN_COLORS: Record<OccupationDomain, string> = {
  institutions: '#C08A7C',
  arts: '#C0A37C',
  'business-law': '#B3C07C',
  'public-figure': '#8AC7A4',
  'science-technology': '#61B89E',
  exploration: '#7C84C0',
  humanities: '#B35680',
  sports: '#C38393',
};

// Display labels for the Legend's pills — design-tokens.md's Occupation
// Domain Palette table names.
export const DOMAIN_LABELS: Record<OccupationDomain, string> = {
  institutions: 'Institutions',
  arts: 'Arts',
  'business-law': 'Business & Law',
  'public-figure': 'Public Figure',
  'science-technology': 'Science & Technology',
  exploration: 'Exploration',
  humanities: 'Humanities',
  sports: 'Sports',
};
