# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` locale resolution

Locale is resolved at runtime, not selected by build mode (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). Paraglide's `strategy: ['url', 'baseLocale']` (`packages/web/vite.config.ts`) reads the request path — `/` resolves to English (the base locale), `/ru/*` to Russian — using Paraglide's default URL pattern, no custom `urlPatterns` needed. `src/app/locale-datasets.ts` reads that resolved locale via `getLocale()` and dynamically imports the matching `packages/shared-types/src/data/{people,conflicts,milestones}(.ru)?.json` files, so a given page load only ever fetches one language's dataset.

There's a single `project.inlang/` config directory (`baseLocale: "en"`, `locales: ["en", "ru"]`) compiled by the Paraglide Vite plugin into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:compile`) so the generated output exists on disk first.

## `packages/web` monitoring (Sentry)

`VITE_SENTRY_DSN` (`packages/web/.env.example`) is the only monitoring config. Unset — the default in local dev — `src/shared/lib/init-monitoring.ts`'s `initMonitoring()` is a no-op, and `logError()` (`src/shared/lib/log-error.ts`) still logs to the console. Set, `main.tsx` initializes Sentry with `sampleRate: 1` (capture every error; this is a read-only app with nothing worth performance-tracing) before the app renders. One DSN, shared across both the `en` and `ru` builds — they're one JS bundle (`docs/deployment.md`), not split per language. In CI, the deploy workflow reads it from the `VITE_SENTRY_DSN` repo secret and passes it to the build step, since Vite bakes `VITE_*` env vars in at build time.

Every error funnels through `logError()` — a React `ErrorBoundary` (`src/shared/ui/ErrorBoundary.tsx`) around `TimelineCanvas` catches render-time crashes, and `locale-datasets.ts`'s `validateEntries()` calls it per dropped entry when pipeline output fails a basic shape check (missing id/name, non-finite date) — so no call site needs to know whether Sentry is actually configured.
