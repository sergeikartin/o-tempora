import { m } from '../paraglide/messages.js';
import type { OccupationDomain } from '../types';

// Mirrors design-tokens.md's Occupation Domain Palette. References the CSS
// custom properties in app/global.css's :root rather than repeating hex;
// SVG presentation attributes resolve var() too, so D3-rendered and DOM
// consumers share it. Lives in shared/config because both the People lane
// and the sidebar pills (swatch) need it.
export const DOMAIN_COLORS: Record<OccupationDomain, string> = {
  institutions: 'var(--color-domain-institutions)',
  arts: 'var(--color-domain-arts)',
  'business-law': 'var(--color-domain-business-law)',
  'public-figure': 'var(--color-domain-public-figure)',
  'science-technology': 'var(--color-domain-science-technology)',
  exploration: 'var(--color-domain-exploration)',
  humanities: 'var(--color-domain-humanities)',
  sports: 'var(--color-domain-sports)',
};

// Pill labels, resolved once at module load from the locale's message
// catalog (web/docs/adr/0005).
export const DOMAIN_LABELS: Record<OccupationDomain, string> = {
  institutions: m['taxonomy.domain.institutions'](),
  arts: m['taxonomy.domain.arts'](),
  'business-law': m['taxonomy.domain.business-law'](),
  'public-figure': m['taxonomy.domain.public-figure'](),
  'science-technology': m['taxonomy.domain.science-technology'](),
  exploration: m['taxonomy.domain.exploration'](),
  humanities: m['taxonomy.domain.humanities'](),
  sports: m['taxonomy.domain.sports'](),
};
