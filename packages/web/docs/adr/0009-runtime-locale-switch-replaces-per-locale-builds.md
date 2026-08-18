---
status: accepted
supersedes: 0005-paraglide-js-replaces-hand-rolled-i18n.md
---

# Runtime locale switch replaces per-locale builds

## Context

The English/Russian split was originally a build-time fork: `vite build --mode en`/`--mode ru` produced two fully independent static outputs, each with its own Paraglide project (`project.en.inlang`/`project.ru.inlang`, `strategy: ['baseLocale']`) and its own `resolve.alias`-swapped dataset files, deployed as `dist/` and `dist/ru/` (`.scratch/russian-localization/spec.md`, ADR 0005). That meant two `vite build` invocations in CI, and `build:en`/`build:ru` as two npm scripts that had to run in a fixed order because both wrote to the same Paraglide `outdir`.

Revisiting it: ADR 0005's own "Consequences" already noted that both locales' compiled message strings ship in every build regardless of `baseLocale` — the stable Paraglide API doesn't tree-shake per locale. The only thing actually forked per build was which locale `getLocale()` defaulted to, and which dataset files `vite.config.ts`'s alias pointed at. Paraglide's stable API supports a `['url', 'baseLocale']` strategy whose default URL pattern (no custom `urlPatterns` needed) already resolves exactly ADR 0003's scheme — base locale unprefixed at the root, every other locale at `/<locale>/*` — from the request URL at runtime instead of a compile-time flag.

## Decision

Single build, single Paraglide project (`project.inlang/`, `baseLocale: "en"`, `locales: ["en", "ru"]`), `strategy: ['url', 'baseLocale']`. `vite.config.ts` uses Vite's native multi-page-app support — `ru/index.html` as a second Rollup input alongside the root `index.html`, both loading the same `/src/main.tsx` — so one `vite build` emits `dist/index.html` and `dist/ru/index.html` sharing the same JS/CSS chunks under `dist/assets/`. `npm run build` replaces `build:en`/`build:ru`; the CI workflow's `build` job drops to one `vite build` invocation.

Dataset loading moves from a build-time alias to a runtime, locale-keyed dynamic `import()` (`src/app/locale-datasets.ts`), so a given page load still only fetches its own language's `people.json`/`conflicts.json`/`milestones.json` (~4.2MB), not both languages' combined (~8.7MB). `App.tsx` reads the resolved datasets via React 19's `use()` inside a `<Suspense>` boundary; the static `<h1>` site title stays outside Suspense so first paint isn't gated on the data fetch.

The `/` ↔ `/ru/` URL scheme, the switcher's full-page-navigation behavior, and "no deep-link/viewport-state preservation across the switch" (russian-localization spec's Out of Scope) are all unchanged — only the mechanism producing them moved from build-time to runtime.

## Why

Once the message-catalog side of the fork was already runtime-resolvable at zero extra cost (per ADR 0005), the only real blocker to a single build was the dataset payload doubling if both languages were bundled together. Per-locale dynamic import removes that blocker without giving up the per-locale-sized payload the two-build architecture existed to guarantee — so there was no longer a reason to pay for two `vite build` invocations, two Paraglide projects that already shared the same `messages/{locale}.json` files, and a manually-ordered two-script `build:en`-then-`build:ru` npm dance.

## Considered Options

**Bundle both locales' datasets into one build statically** — rejected. Doubles the payload every page load fetches regardless of which language is actually viewed; the whole point of the per-locale split was keeping each build's data weight to one language's worth.

**GitHub Pages 404.html SPA-fallback for `/ru/*`** — rejected in favor of Vite's multi-page build. The 404 trick serves real content but with an HTTP 404 status, which is unnecessary once Vite can emit both `dist/index.html` and `dist/ru/index.html` as genuine 200-serving files from one build pass.

**Custom Paraglide `urlPatterns`** — rejected as unnecessary. Paraglide's default URL pattern (unrecognized first path segment falls back to the base locale, a recognized locale segment like `ru` matches it) already reproduces the base-locale-unprefixed scheme ADR 0003 established, with no config beyond `strategy: ['url', 'baseLocale']`.

## Consequences

- `project.en.inlang/` and `project.ru.inlang/` are removed; `project.inlang/` is the single source, pointing at the same `messages/{en,ru}.json` files both old projects already shared.
- `vite.config.ts` no longer branches on Vite `mode` at all — `base`, the Paraglide project, and the dataset resolution are the same regardless of how the app is invoked (`dev`, `vitest`, or `build`).
- `App.tsx`'s data-dependent content now renders inside a `Suspense` boundary; `App.test.tsx`'s synchronous assertion on the `<h1>` still passes unchanged since that heading is static and stays outside the boundary.
- CI's `deploy.yml` `build` job runs one `vite build` instead of two.
