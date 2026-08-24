Type: task
Status: open

# LCP: critical-CSS extraction/inlining

## Context

Follow-up to issues 14 and 16. Issue 14's original audit flagged `main.css` as render-blocking, costing an estimated ~1,010 ms of mobile LCP under throttling — the single largest concrete lever found, deliberately deferred pending the cheaper tier0/font-preload work in issue 16.

Issue 16 shipped that preload work and re-measured (isolated same-hardware A/B, `chrome-devtools-mcp`, Slow 4G + 4x CPU throttle, local production build): mobile LCP improved 18,508 ms → 13,377 ms (−28%) from the preload change alone, current `dev` HEAD at 12,041 ms. Render delay is still ~99.9% of LCP (TTFB negligible), and the `RenderBlocking` insight still shows an estimated ~387–394 ms of LCP savings available post-preload — smaller than issue 14's original ~1,010 ms estimate (the preload work likely already clawed back some of it), but still real and still the largest single lever left. Mobile LCP remains solidly "Poor" (>4,000 ms) on this throttle profile.

## The problem

`main.css` blocks initial render. The app is CSS-Modules-per-widget (no single global stylesheet designed to be split into critical/non-critical by hand), and `TimelineCanvas.tsx` measures `container.clientWidth` post-mount to seed the D3 x-scale (`options.ts:274-280`) — that measurement implicitly assumes layout CSS is already applied synchronously when it runs. A naive defer-all-CSS approach risks a layout-thrashing flash (unstyled or wrongly-sized canvas at first measurement) or a CLS regression.

## Decided approach (per issue 14/16's original scoping)

Use an automated tool rather than hand-curating critical CSS — `beasties` (the maintained successor to deprecated `critters`; confirmed at issue-14 time that neither `critters`, `beasties`, nor `vite-plugin-critical` are in `packages/web/package.json` yet, so this is a new dependency).

1. Add `beasties` to `packages/web`, wire it into the build (likely another `transformIndexHtml`-style Vite plugin, following the pattern already established by `vite-plugins/tier0-modulepreload.ts` and `vite-plugins/critical-font-preload.ts`) to inline above-the-fold CSS in `<head>` and defer the rest.
2. Write a regression test asserting the tool's inlined output includes the selectors `TimelineCanvas`'s `container.clientWidth` measurement structurally depends on — `.wrapper`/`.scrollContainer` from `TimelineCanvas.module.css:1-8,109-115` (issue 14's flagged risk: don't let critical-CSS extraction silently drop the rules that layout measurement assumes are already applied).
3. Verify per-locale (`dist/index.html` and `dist/ru/index.html` both get correct inlined CSS — same locale-scoping concern as issue 16's preload plugins) and per-viewport (mobile drawer layout vs. desktop `Minimap` layout, `TimelineCanvas.tsx:1040`, both need their critical CSS covered, not just one).
4. Measure LCP after, same methodology as issues 14/16 (same-hardware before/after A/B if run in a sandboxed session without access to `otempora.info`; cold-cache, Slow 4G + 4x CPU throttle). Record baseline (this ticket's Context numbers) vs. result in the Resolution.
5. Explicitly check CLS doesn't regress (both prior audits found CLS 0.00 — that's a real invariant to preserve, not just LCP).

## Risk / why this was deferred twice already

Real engineering, not a cheap change — per issue 14: "risks visual regressions across two locales and both layouts if done hastily." Budget for iterating on `beasties`' config (its critical-viewport heuristics may need tuning for this app's above-the-fold content) and for the regression test in step 2 actually catching a bad extraction before it ships, not after.

## Comments
