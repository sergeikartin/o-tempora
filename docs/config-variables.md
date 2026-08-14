# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` build mode — language selector

`vite build --mode ru` (via `npm run build:ru --workspace packages/web`) bundles the Russian lane dataset files (`packages/shared-types/src/data/{people,conflicts,milestones}.ru.json`) instead of the English ones, and writes to `dist/ru` instead of `dist/en`. Any other mode — the dev server, `vitest`, or a bare `vite build` (equivalently `npm run build:en`) — bundles English, the app's default. This is resolved entirely in `packages/web/vite.config.ts` via `resolve.alias`, keyed off Vite's `mode`; `App.tsx`'s own data-import statements are unaffected either way. Build-time only — no runtime language toggle (see `.scratch/russian-localization/spec.md`'s Out of Scope).

The same `mode` branch also selects which of the two `project.{en,ru}.inlang/` config directories the Paraglide Vite plugin compiles (`docs/adr/0005-paraglide-js-replaces-hand-rolled-i18n.md`) — each fixes a different `baseLocale` for its message catalog, generated into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build:en`/`build:ru`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:en`/`paraglide:ru`) so the generated output exists on disk first.
