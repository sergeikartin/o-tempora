# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` locale resolution

Locale is resolved at runtime, not selected by build mode (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). Paraglide's `strategy: ['url', 'baseLocale']` (`packages/web/vite.config.ts`) reads the request path — `/` resolves to English (the base locale), `/ru/*` to Russian — using Paraglide's default URL pattern, no custom `urlPatterns` needed. `src/app/locale-datasets.ts` reads that resolved locale via `getLocale()` and dynamically imports the matching `packages/shared-types/src/data/{people,conflicts,milestones}(.ru)?.json` files, so a given page load only ever fetches one language's dataset.

There's a single `project.inlang/` config directory (`baseLocale: "en"`, `locales: ["en", "ru"]`) compiled by the Paraglide Vite plugin into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:compile`) so the generated output exists on disk first.
