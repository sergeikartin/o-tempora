import type { OccupationDomain } from '../types';
import { LANG } from '../i18n';

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
// Occupation Domain Palette table names. Bilingual, picked once at module
// load by the build-time LANG flag (shared/i18n) — every consumer reads
// the same DOMAIN_LABELS export regardless of language, unchanged.
const DOMAIN_LABELS_EN: Record<OccupationDomain, string> = {
  institutions: 'Institutions',
  arts: 'Arts',
  'business-law': 'Business & Law',
  'public-figure': 'Public Figure',
  'science-technology': 'Science & Technology',
  exploration: 'Exploration',
  humanities: 'Humanities',
  sports: 'Sports',
};

const DOMAIN_LABELS_RU: Record<OccupationDomain, string> = {
  institutions: 'Институты',
  arts: 'Искусство',
  'business-law': 'Бизнес и право',
  'public-figure': 'Публичная персона',
  'science-technology': 'Наука и технологии',
  exploration: 'Экспедиции',
  humanities: 'Гуманитарные науки',
  sports: 'Спорт',
};

export const DOMAIN_LABELS: Record<OccupationDomain, string> = LANG === 'ru' ? DOMAIN_LABELS_RU : DOMAIN_LABELS_EN;
