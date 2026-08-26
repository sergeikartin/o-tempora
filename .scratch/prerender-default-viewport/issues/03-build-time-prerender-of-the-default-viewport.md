# 03 — Build-time prerender of the default viewport

**What to build:** The actual feature (ADR 0013 / `.scratch/prerender-default-viewport/spec.md`). A visitor loading `index.html` or `ru/index.html` sees the real default-viewport timeline — People lane marks, Conflicts+Milestones lane marks, and the Year Axis with decade labels — the moment HTML/CSS load, before any JS runs. Once JS boots, the app hydrates in place with no visible flash, re-render, or handoff moment. Every interaction (pan, zoom, Search, filters, tooltip, Minimap) is unchanged.

**Mechanism:**
- New `App.tsx` seam: `App`/`AppContent` accept an optional `initialDatasets?: LocaleDatasets` prop; `AppContent` uses `initialDatasets ?? use(localeDatasetsPromise)`. `main.tsx`'s real `<App />` call is unaffected (prop stays `undefined`, current behavior exactly preserved).
- New `vite-plugins/prerender-default-viewport.ts`, matching the existing three plugins' shape (`apply: 'build'`, `transformIndexHtml: { order: 'post', handler }`, no-ops when `!ctx.bundle`). Per HTML entry/locale, spins up a fresh ephemeral Vite SSR context (reusing the real build's resolved `css`/`resolve` config for CSS-Module class-name parity), sets the Paraglide locale before loading anything else, loads the four tier0 JSON files directly, computes layout via the pure functions from [[01-shared-mark-shape-descriptor]], calls `renderToStaticMarkup(<App initialDatasets={...} />)`, and grafts the mark HTML into the three empty `<g class="people/ranges/points"></g>` via literal string replacement.
- `vite.config.ts` registers the new plugin between `criticalFontPreloadPlugin()` and `criticalCssPlugin()` — ordering is load-bearing so Beasties' critical-CSS pass sees real class-bearing markup.
- `main.tsx` switches from `createRoot(...).render(<App />)` to `hydrateRoot(rootElement, <App />)`, unconditionally (no "was this prerendered" detection needed).

**Blocked by:** 01 (pure layout builders + mark-shape templaters), 02 (D3 adoption — without it, hydration would destroy/recreate every prerendered mark, defeating the point and likely throwing on the keyed join against unbound nodes).

**Status:** done

- [x] `App.tsx` accepts `initialDatasets` as described; `App.test.tsx` and all other existing callers are unaffected.
- [x] `vite-plugins/prerender-default-viewport.ts` exists, follows the existing plugin pattern, and correctly no-ops on the dev server.
- [x] The plugin renders both `index.html` (en) and `ru/index.html` (ru) with their own isolated locale/module state — verify no cross-locale text leakage (e.g. Data Depth label, headings).
- [x] Prerendered mark markup for People and Conflicts+Milestones matches the shared descriptor from [[01-shared-mark-shape-descriptor]] exactly — new test asserts structural equivalence against the same fixture rendered live via `PeopleLane`/`ConflictsMilestonesLane` (RTL), per spec.md's testing decision.
- [x] Prerendered output contains real content for a fixture (a known person's name/dates, a known conflict/milestone's marker, real decade-label text), not an empty shell.
- [x] `YearAxis.test.tsx` gains cases comparing `renderToStaticMarkup(<YearAxis .../>)` output against the existing live-rendered assertions for the same props.
- [x] `vite.config.ts` registers the new plugin in the correct order (after `criticalFontPreloadPlugin()`, before `criticalCssPlugin()`).
- [x] `main.tsx` uses `hydrateRoot`.
- [x] `npm run build --workspace packages/web`, then serving `dist/` and viewing source of both `/index.html` and `/ru/index.html` shows real People/Conflicts+Milestones marks and Year Axis decade labels in the raw HTML.
- [x] Loading both pages with JS enabled shows no visible flash/flicker/re-layout at hydration; panning, zooming, Search, filters, and the detail tooltip all still work exactly as before.
- [x] Loading either page with JS disabled still shows the default view's real content (names, dates, axis).
- [x] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint:boundaries --workspace packages/web` pass.

## Comments

Implementation deviated from the planned Mechanism in three ways, each forced by a real hydration failure discovered while verifying against an actual browser (not just tests):

- **`renderToReadableStream` + `.allReady`, not `renderToStaticMarkup`.** `App.tsx`'s tree still has real `<Suspense>` boundaries (the two lazy-loaded panels), and `renderToStaticMarkup` neither waits for them nor emits the hydration markers a `<Suspense>` boundary needs — `hydrateRoot` threw a hydration-mismatch error at that boundary even though the content matched. `renderToReadableStream`, awaited to `allReady`, resolves this the same way any streaming-SSR app does.
- **No build-time markup computation or string-graft step.** Instead, `PeopleLane`/`ConflictsMilestonesLane` each compute their own initial mark HTML once, via a lazy `useState` initializer calling the shared templater (`mark-shape-html.ts`, still consuming `mark-shape.ts`'s `MarkShape` descriptors — same shared-descriptor property, just one fewer call site) — identically on server and client, since both derive it from the same `layout`. This made the originally-planned `default-viewport-markup.ts` orchestrator (and its build-time graft into the three empty `<g>`s) unnecessary: the plugin now just renders `<App initialDatasets={...} />` and the marks are already there. Discovered because grafting the markup into a `<template>` (an earlier attempt, to dodge a *different* hydration issue below) made the marks invisible without JS — defeating the feature's actual point.
- **The `dangerouslySetInnerHTML` value object has to be frozen too, not just the string.** `<g dangerouslySetInnerHTML={{ __html: x }} />` — a fresh `{ __html: x }` object literal every render — made React re-apply (and therefore re-assert) the *original* SSR string on every subsequent re-render of the component, silently reverting every D3 attribute update since mount. Symptom: marks rendered correctly at first paint, survived hydration, but then zoom/pan stopped visibly moving them (attributes update, then get reverted a moment later) — only caught by testing an actual zoom interaction in a real browser, not just checking hydration console-cleanliness. Fixed by freezing the whole `{ __html }` object in the same `useState` lazy initializer.

Also fixed in passing: `shared/lib/viewport.ts`'s `useIsMobileViewport` was calling `useSyncExternalStore` without a `getServerSnapshot` argument, which made React bail the entire tree to its Suspense fallback during `renderToReadableStream`/`renderToString` (any real SSR entry point, not just `renderToStaticMarkup`). Added a `getServerSnapshot` that always returns `false`, matching the server's own no-`matchMedia` fallback.
