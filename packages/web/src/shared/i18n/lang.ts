// Build-time language flag — mirrors vite.config.ts's data-file alias
// selector (docs/config-variables.md): Vite's own `--mode`, not a runtime
// toggle (russian-localization spec's Out of Scope — no client-side
// language switch). `import.meta.env.MODE` is `'ru'` only for a
// `vite build --mode ru` build; every other mode (dev server, vitest, or a
// bare `vite build`) is English, the app's default.
export const LANG: 'en' | 'ru' = import.meta.env.MODE === 'ru' ? 'ru' : 'en';

// The sibling deployment's default (home) view — the two builds are
// deployed as independent static outputs under `/en` and `/ru` subpaths of
// the same domain (see docs/deployment.md). Root-relative so it resolves
// correctly regardless of which subpath this build itself is served from.
// Points at the sibling's root only — no deep-link/viewport-state
// preservation across the switch (russian-localization spec's Out of
// Scope).
export const SWITCH_LANGUAGE_HREF = LANG === 'ru' ? '/en/' : '/ru/';
