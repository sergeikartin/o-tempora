Type: task
Status: resolved

# LCP: preload tier0 data chunks + above-the-fold fonts (mobile)

## Context

Follow-up to issue 14. Mobile LCP is 6,931 ms ("Poor"), dominated by tier0 JSON fetch + main bundle parse/execute; desktop is already "Good" (1,675 ms). This ticket implements the two cheapest, fully-scoped levers decided in a `/grilling` session, before the deferred critical-CSS extraction is attempted.

## Ruled out this session

- **Astro migration** — no static shell to gain; the timeline fills the viewport.
- **Real SSR** — GitHub Pages has no per-request server runtime.
- **Build-time prerender** (`ReactDOMServer.renderToString` baked into `index.html`, hydrate on load) — investigated in depth, then abandoned. The D3 x-scale range is a real measured-pixel value (`options.ts:274-280`), seeded from `container.clientWidth` measured post-mount (`TimelineCanvas.tsx:531-540`), not `viewBox`-relative — so no single build-time render can be pixel-seamless across visitor viewport widths. Below the 640px breakpoint the layout is also structurally different (drawer toggle vs. `Minimap`, `TimelineCanvas.tsx:1040`), not just narrower. GitHub Pages can't route per-device without either a client-side redirect (costs more than it saves — an extra navigation gating the real paint) or an edge/CDN layer (out of scope — contradicts "static hosting only"). A two-variant CSS-toggle-and-hydrate mechanism was sketched as a workaround but shelved once these cheaper, better-ROI levers turned up.

## Decided plan

1. **tier0 modulepreload.** tier0 datasets are dynamic-imported JSON wrapped into JS chunks with per-build content-hashed filenames (`locale-datasets.ts:73-90`, e.g. `people.tier0-BbIYu9Hy.js`) — not stable-path fetches. Confirmed via a production build that Vite does **not** auto-inject modulepreload for them (`dist/index.html` currently has zero preload/modulepreload hints). Add a small Vite plugin using the `transformIndexHtml` hook, reading the build manifest, injecting `<link rel="modulepreload">` (not `rel="preload" as="fetch"` — wrong primitive for a JS module chunk) with the correct hashed href. **Locale-specific**: EN's `index.html` preloads EN tier0 chunks, RU's preloads RU tier0 chunks, matching `vite.config.ts`'s `main`/`ru` entries — preloading the other locale wastes critical-path bandwidth for no benefit.

2. **Font preload.** Preload only `@fontsource/archivo` weights **400 and 700** — the two weights actually used above the fold on *both* mobile and desktop: timeline lane labels (`PeopleLane.module.css:84`, `ConflictsMilestonesLane.module.css:79`, both inherited 400), year-axis ticks (`YearAxis.module.css:64`, 400) and the century tab (`YearAxis.module.css:104`, explicit 700). Explicitly do **not** preload `Fraunces` 600 or `Archivo` 600 — those belong to the `Sidebar` only (`Sidebar.module.css:97-102,47-53`; `DataDepthSwitch.module.css:63-67`), and the `Sidebar` is off-canvas and `inert` on mobile until the drawer is opened (`Sidebar.module.css:183-208`). Since GitHub Pages serves one static HTML file to every visitor and mobile is the platform this effort targets, preloading fonts for content mobile visitors can't see yet would compete with the fetches that actually gate mobile LCP.

3. **Sequencing.** Implement tier0 preload first, then font preload, measuring after each with the same methodology as issue 14 (`chrome-devtools-mcp` Lighthouse/trace, deployed prod with local-build fallback, Slow 4G + 4x CPU throttle for mobile) — so a regression is attributable to a single change. Record updated numbers against the issue-14 baseline (desktop 1,675 ms / mobile 6,931 ms) in this ticket's Resolution when done.

4. Normal feature branch + PR, standard review — not a spike. The mechanism is fully specified; nothing architecturally uncertain remains.

## Deferred, explicit follow-up

Critical-CSS extraction/inlining — issue 14's original "highest-value next step," an estimated ~1,010 ms of mobile LCP per the RenderBlocking insight — is intentionally **not** part of this ticket. Decide whether to pursue it after measuring the above; if tier0 + font preload close most of the gap, it may not be worth the added risk.

If pursued later: no critical-CSS tooling exists in the repo yet (checked — no `critical`/`vite-plugin-critical`/`beasties`/`critters` in `packages/web/package.json`). Use an automated tool (`beasties`, the maintained successor to deprecated `critters`) rather than hand-curation, and write a regression test asserting its output includes `.wrapper`/`.scrollContainer` from `TimelineCanvas.module.css:1-8,109-115` — the selectors `TimelineCanvas`'s `container.clientWidth` measurement structurally depends on (issue 14's flagged risk: that measurement assumes CSS is already applied synchronously).

## Comments

Implemented both levers as two small `transformIndexHtml` Vite plugins (`packages/web/vite-plugins/tier0-modulepreload.ts`, `critical-font-preload.ts`), each reading the build's output bundle to inject the right `<link>` tags per HTML entry — locale-scoped `modulepreload` for tier0 chunks, `preload` for the Archivo 400/700 latin-subset `.woff2` files. Verified against a production build: `dist/index.html` preloads only the three EN tier0 chunks, `dist/ru/index.html` only the three RU ones, and both preload the same two font files. Full test/typecheck/lint suite green.

LCP measurement (issue-14 methodology): `otempora.info` was unreachable from this session's sandbox (network egress blocked), so both runs used the local-build fallback exclusively, in a fresh isolated browser context with cache disabled per navigation (cold-cache, matching a first-time visitor) — `chrome-devtools-mcp`, Slow 4G + 4x CPU throttle, EN.

**Desktop** (no throttle, current `dev`/HEAD build): LCP 1,763 ms — "Good", in line with issue 14/16's 1,616–1,763 ms range (a local `http.server` isn't as fast as the CDN issue 14 measured against, accounting for the small delta).

**Mobile, isolated A/B on this session's machine** (same hardware/throttle profile both runs, to isolate this ticket's change from cross-session hardware noise — absolute numbers here run higher than issue 14's 6,931 ms baseline, which was measured on different hardware; the *relative* delta is the reliable signal):
- Before (commit `5f8abef`, pre-preload): LCP 18,508 ms. `RenderBlocking` insight: ~1,002 ms estimated savings.
- After (commit `aeb8735`, this ticket's preload plugins only): LCP 13,377 ms. `RenderBlocking` insight: ~387 ms estimated savings.
- **Preload alone: −5,131 ms (−28%).**
- Current `dev`/HEAD (preload + later unrelated cleanup — named Sentry imports, Temporal removal): LCP 12,041 ms, a further −1,336 ms from bundle trimming.

Both before and after runs show render delay at ~99.9% of LCP (TTFB ~7 ms) — confirms issue 14's finding that this is a JS-parse/fetch/render-bound page, not network-latency-bound, and that finding is unchanged by this ticket's fix. Mobile LCP is meaningfully improved but still "Poor" (>4,000 ms) on this throttle profile; the preload levers reduced, but didn't eliminate, the gap.

**Decision on the deferred critical-CSS follow-up**: still worth pursuing. The `RenderBlocking` insight persists post-preload (~387–394 ms estimated LCP savings, consistent with issue 14's original ~1,010 ms estimate before other levers landed) and mobile LCP remains well outside "Good". Keep it as its own future ticket per issue 14's original scoping — not attempted here.
