import { m } from '../paraglide/messages.js';
import type { OccupationDomain } from '../types';

// Mirrors design-tokens.md's Occupation Domain Palette, sourced directly
// from pantheon.world's own CSS custom properties (--colorInstitutions etc.)
// so ours matches theirs exactly. References the CSS custom properties
// wired in app/global.css's :root rather than repeating hex here — SVG
// presentation attributes (People lane's fill/stroke) resolve var() same as
// any other CSS property, so this works for D3-rendered and plain-DOM
// consumers alike. Lives in shared/config, not
// widgets/timeline-canvas/options.ts, since both the People lane (bar fill)
// and the sidebar's Occupation Domain pills (swatch) need it — a shared
// value, not D3-rendering-specific.
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

// Display labels for the Occupation Domain pills — design-tokens.md's
// Occupation Domain Palette table names. Picked once at module load from
// the compiled locale's message catalog (docs/adr/0005) — every consumer
// reads the same DOMAIN_LABELS export regardless of language, unchanged.
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
