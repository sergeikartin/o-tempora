import { getLocale } from '../paraglide/runtime.js';

// The sibling deployment's default (home) view — English is served from the
// domain root, every other locale from its own `/<locale>/` subpath (Russian
// at `/ru`; see docs/deployment.md, docs/adr/0003). Root-relative so it
// resolves correctly regardless of which subpath this build itself is
// served from. getLocale() resolves to this build's compiled baseLocale
// (docs/adr/0005's strategy: ['baseLocale'], no runtime detection) — the
// drop-in replacement for the old shared/i18n LANG flag. Points at the
// sibling's root only — no deep-link/viewport-state preservation across the
// switch (russian-localization spec's Out of Scope).
export const SWITCH_LANGUAGE_HREF = getLocale() === 'ru' ? '/' : '/ru/';
