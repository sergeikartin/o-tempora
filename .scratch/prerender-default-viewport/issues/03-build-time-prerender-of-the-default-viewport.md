# 03 — Build-time prerender of the default viewport

**What to build:** The actual feature (ADR 0013 / `.scratch/prerender-default-viewport/spec.md`). A visitor loading `index.html` or `ru/index.html` sees the real default-viewport timeline — People lane marks, Conflicts+Milestones lane marks, and the Year Axis with decade labels — the moment HTML/CSS load, before any JS runs. Once JS boots, the app hydrates in place with no visible flash, re-render, or handoff moment. Every interaction (pan, zoom, Search, filters, tooltip, Minimap) is unchanged.

**Mechanism:**
- New `App.tsx` seam: `App`/`AppContent` accept an optional `initialDatasets?: LocaleDatasets` prop; `AppContent` uses `initialDatasets ?? use(localeDatasetsPromise)`. `main.tsx`'s real `<App />` call is unaffected (prop stays `undefined`, current behavior exactly preserved).
- New `vite-plugins/prerender-default-viewport.ts`, matching the existing three plugins' shape (`apply: 'build'`, `transformIndexHtml: { order: 'post', handler }`, no-ops when `!ctx.bundle`). Per HTML entry/locale, spins up a fresh ephemeral Vite SSR context (reusing the real build's resolved `css`/`resolve` config for CSS-Module class-name parity), sets the Paraglide locale before loading anything else, loads the four tier0 JSON files directly, computes layout via the pure functions from [[01-shared-mark-shape-descriptor]], calls `renderToStaticMarkup(<App initialDatasets={...} />)`, and grafts the mark HTML into the three empty `<g class="people/ranges/points"></g>` via literal string replacement.
- `vite.config.ts` registers the new plugin between `criticalFontPreloadPlugin()` and `criticalCssPlugin()` — ordering is load-bearing so Beasties' critical-CSS pass sees real class-bearing markup.
- `main.tsx` switches from `createRoot(...).render(<App />)` to `hydrateRoot(rootElement, <App />)`, unconditionally (no "was this prerendered" detection needed).

**Blocked by:** 01 (pure layout builders + mark-shape templaters), 02 (D3 adoption — without it, hydration would destroy/recreate every prerendered mark, defeating the point and likely throwing on the keyed join against unbound nodes).

**Status:** ready-for-agent

- [ ] `App.tsx` accepts `initialDatasets` as described; `App.test.tsx` and all other existing callers are unaffected.
- [ ] `vite-plugins/prerender-default-viewport.ts` exists, follows the existing plugin pattern, and correctly no-ops on the dev server.
- [ ] The plugin renders both `index.html` (en) and `ru/index.html` (ru) with their own isolated locale/module state — verify no cross-locale text leakage (e.g. Data Depth label, headings).
- [ ] Prerendered mark markup for People and Conflicts+Milestones matches the shared descriptor from [[01-shared-mark-shape-descriptor]] exactly — new test asserts structural equivalence against the same fixture rendered live via `PeopleLane`/`ConflictsMilestonesLane` (RTL), per spec.md's testing decision.
- [ ] Prerendered output contains real content for a fixture (a known person's name/dates, a known conflict/milestone's marker, real decade-label text), not an empty shell.
- [ ] `YearAxis.test.tsx` gains cases comparing `renderToStaticMarkup(<YearAxis .../>)` output against the existing live-rendered assertions for the same props.
- [ ] `vite.config.ts` registers the new plugin in the correct order (after `criticalFontPreloadPlugin()`, before `criticalCssPlugin()`).
- [ ] `main.tsx` uses `hydrateRoot`.
- [ ] `npm run build --workspace packages/web`, then serving `dist/` and viewing source of both `/index.html` and `/ru/index.html` shows real People/Conflicts+Milestones marks and Year Axis decade labels in the raw HTML.
- [ ] Loading both pages with JS enabled shows no visible flash/flicker/re-layout at hydration; panning, zooming, Search, filters, and the detail tooltip all still work exactly as before.
- [ ] Loading either page with JS disabled still shows the default view's real content (names, dates, axis).
- [ ] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint:boundaries --workspace packages/web` pass.
