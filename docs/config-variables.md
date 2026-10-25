# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` locale resolution

Locale is resolved at runtime, not selected by build mode (`packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). Paraglide's `strategy: ['url', 'baseLocale']` (`packages/web/vite.config.ts`) reads the request path — `/ru/*` resolves to Russian, every other path (`/`, `/timeline/`) to English (the base locale) — using Paraglide's default URL pattern, no custom `urlPatterns` needed. `src/app/locale-datasets.ts` reads that resolved locale via `getLocale()` and dynamically imports the matching `packages/shared-types/src/data/{people,conflicts,milestones}.detail1(.ru)?.json`/`.detail2(.ru)?.json` files eagerly (gating first paint), so a given timeline page load only ever fetches one language's level 1+2 payload (the landing pages fetch no datasets); the `.detail3`/`.detail4` siblings load separately, deferred to idle time or on demand (see Detail Level below).

There's a single `project.inlang/` config directory (`baseLocale: "en"`, `locales: ["en", "ru"]`) compiled by the Paraglide Vite plugin into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:compile`) so the generated output exists on disk first.

## `packages/web`/`packages/data-pipeline` Detail Level

Each lane's Output stage (`packages/data-pipeline/src/output/`) splits its dataset into 4 delta files (`<lane>.detail1.json` .. `<lane>.detail4.json`, plus `.ru` siblings) by `DETAIL_LEVEL_FAME_SCORE_FLOORS` (`packages/shared-types`, People 91/88/84/80, Conflicts 86/82/78/64, Milestones 87/82/76/55) — see `CONTEXT.md`'s Detail Level entry and `docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md`. Each delta file holds only the entities newly added versus the previous level, not a self-contained cumulative file. `src/app/locale-datasets.ts` loads level 1+2 eagerly, combined; level 3 via a dynamic import deferred to idle time, skipped on a save-data/slow (`slow-2g`/`2g`) connection until `requestLevel3Load()` is called explicitly; level 4 strictly on demand via `requestLevel4Load()` (which also ensures level 3 is loading, since level 4's cumulative view needs it too) — the Detail Level switch's Specialized/Deep Cut options trigger these. `src/app/use-detail-level-datasets.ts` concatenates level 3/4 into the level 1+2 base once each resolves; which level an entry shipped in never affects whether it renders, only the client-side Fame Score filter does. Once fetched, a level's data stays in memory for the rest of the session — never re-fetched, never evicted.

## `packages/web` feature flags

`src/shared/lib/feature-flags/`'s `hasFeatureFlag(name)` checks for a URL query param of that name — no build config or persistence, since these gate developer-only debug UI rather than user-facing behavior. No shipped flag uses it today; the raw per-lane Fame Score floor override is the dev-console function below.

## `packages/web` dev-console Fame Score override

`src/features/filter-by-fame-score/model/dev-fame-score-override.ts` exposes `window.__setFameScoreFloors({ people, conflicts, milestones })` (any subset of lanes) from the browser console, wired to the same state the Detail Level switch drives — for tuning `FAME_SCORE_BOUNDS`/Detail Level floors without a local dev server. Dev-build only: guarded by `import.meta.env.DEV`, which the minifier strips from production builds entirely (verified by grepping `dist/assets/*.js` for `setFameScoreFloors` after `npm run build`).

## `packages/data-pipeline` Profile writer credentials

`profiles write` (`packages/data-pipeline/src/profiles/providers.ts`) reads the provider SDKs' standard environment variables: `OPENAI_API_KEY` for `--provider=openai` (the default) and `ANTHROPIC_API_KEY` for `--provider=anthropic` and `GEMINI_API_KEY` for `--provider=gemini`. None is needed by any other pipeline command. `--model` overrides the default model (`gpt-6-astra`, `claude-opus-5-5`, `gemini-4-argon`); `--concurrency` sets the parallel requests (default 3).

## Monitoring and analytics

See `docs/observability.md`.
