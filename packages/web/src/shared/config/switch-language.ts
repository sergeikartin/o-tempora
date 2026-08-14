import { getLocale } from '../paraglide/runtime.js';

// The sibling deployment's default (home) view — the two builds are
// deployed as independent static outputs under `/en` and `/ru` subpaths of
// the same domain (see docs/deployment.md). Root-relative so it resolves
// correctly regardless of which subpath this build itself is served from.
// getLocale() resolves to this build's compiled baseLocale (docs/adr/0005's
// strategy: ['baseLocale'], no runtime detection) — the drop-in replacement
// for the old shared/i18n LANG flag. Points at the sibling's root only — no
// deep-link/viewport-state preservation across the switch (russian-
// localization spec's Out of Scope).
export const SWITCH_LANGUAGE_HREF = getLocale() === 'ru' ? '/en/' : '/ru/';
