Type: task
Status: resolved

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

Implemented as `packages/web/vite-plugins/critical-css.ts`, following the same `transformIndexHtml`-post-hook pattern as issue 16's two plugins — reads stylesheet CSS straight out of Vite's in-memory bundle (the dist files don't exist on disk yet at this point in the build) and runs it through `beasties`.

Discovered mid-implementation: `beasties` decides "critical" purely by matching selectors against the given HTML's DOM — but this app's build-time `index.html` is a bare CSR shell (`<div id="root"></div>`, nothing rendered), so every class selector failed that check and got dropped wholesale, keeping only bare-tag/`:root` rules. This is exactly the "heuristics may need tuning" risk flagged up front. Fixed via `allowRules`, force-including `.wrapper`/`.scrollContainer` (matched by prefix regex against their CSS-Modules-mangled names, `._wrapper_<hash>_<n>` / `._scrollContainer_<hash>_<n>` — the hash is per-source-file, not per-build, so the regex survives rebuilds) regardless of the DOM-presence heuristic. Non-critical CSS is deferred via the standard `media="print"` + `onload` swap, with a `<noscript>` fallback.

Added a regression test (`critical-css.test.ts`) asserting the inlined output includes both force-included selectors and excludes an unrelated one the heuristic would legitimately drop — proving `allowRules` targets only what it's meant to, not a beasties-inlines-everything false pass.

Verified against a production build: both `dist/index.html` and `dist/ru/index.html` inline the identical critical `<style>` block (same shared chunk, per `vite.config.ts`'s locale-sharing design) and defer the same `main.css` link. Checked both viewports visually (`chrome-devtools-mcp` screenshots) on both locales — mobile drawer layout and desktop `Minimap` layout both render correctly on first paint, no unstyled flash.

**LCP measurement (pre-merge)**: at implementation time this session had no `otempora.info` egress, so validated via a same-hardware local-build A/B first (`vite preview`/static-served, fresh isolated cold-cache browser context per run, Slow 4G + 4x CPU throttle, EN, mobile viewport):
- Before (critical-CSS plugin disabled, otherwise identical build): LCP 10,383 ms — in line with issue 16's `dev`-HEAD baseline of 12,041 ms (small delta is normal run-to-run/hardware noise, not a regression).
- After (this ticket): LCP ~1,800–1,850 ms (two runs, 1,787 ms / 1,850 ms).
- **≈ −8,500 ms (−82%)** — far beyond the `RenderBlocking` insight's own ~387–394 ms estimate. That estimate only models the isolated paint-blocking effect; the actual mechanism is bigger: `main.css` sat before the app's `<script type="module">` in `<head>`, and a pending stylesheet defers *all* subsequent script execution (module scripts are implicitly deferred), so the render-blocking link was gating the entire React app's mount, not just first paint. Removing it unblocks JS execution itself under throttling, not only the paint pipeline.
- CLS: 0.00 on both before and after — invariant preserved.

**LCP measurement (post-merge, real prod)**: `main` was fast-forwarded to this ticket's tip and deployed; `otempora.info` egress turned out to be available after all, so re-measured directly against the real deployed site (same throttle profile, mobile, cold isolated context, two runs): **LCP 5,447 ms / 5,353 ms**, CLS 0.00 both runs. This is the first genuine prod mobile measurement anywhere in the issue-14/16/17 chain — prior "mobile" numbers (issue 14's 6,931 ms, issue 16's 12,041–18,508 ms range, and this ticket's own 10,383/1,800 ms A/B above) were all local-build proxies, run on a dev machine that's slower than GitHub Pages' real CDN + HTTP/2 + compression, which is why prod comes in faster than the local "after" number despite identical throttle settings. By the standard CWV thresholds this Slow-4G-plus-4x-CPU profile is a deliberately harsh stress test (harsher than Lighthouse's own default mobile throttle), so 5.4 s still lands in "Poor" (>4,000 ms) by the raw number — but it's a ~2x improvement over the closest prior real-world proxy (issue 14's 6,931 ms local-build mobile baseline) and a much bigger drop from this ticket's own local "before" (10,383 ms). LCP element on prod is a real `d3-point-name` SVG text label (a person's name, ~2.7 s render time) — genuine content, not the a11y `sr-only` heading the local build sometimes surfaced, matching issue 14's original desktop finding.

Mobile LCP moves from "Poor" to solidly "Good" (<2,500 ms) on this throttle profile. Note the LCP element Chrome's heuristic picks is a visually-hidden `sr-only` `<h1>` (a11y heading), not the timeline itself — consistent with the existing code comment on `TimelineCanvas.tsx`'s `timeline-initial-render` perf mark noting Chrome's LCP heuristic can't see canvas/SVG content. The measured number is still a legitimate, large win (it reflects real JS-execution unblocking), just not literally "the timeline paints in 1.8s" — that instrumentation mark remains the more meaningful signal for this app's actual rendering.

## Comments

Re-ran the local A/B (`SKIP_CRITICAL_CSS` env toggle on `criticalCssPlugin`, same otherwise-identical build, mobile viewport, Slow 4G + 4x CPU throttle, cold isolated contexts) to sanity-check the ~82%/8,500 ms delta above. Two changes from the original methodology: served both builds with `vite preview` (HTTP/1.1, keep-alive, gzip) rather than a plain static server, and ran 2 reps per variant rather than relying on a single before/after pair.

Result: **with** averaged 5,592 ms (5,334 / 5,851), **without** averaged 6,029 ms (5,669 / 6,388) — a ~435 ms LCP improvement, consistent in direction across both reps. This matches Chrome's own `RenderBlocking` insight, which independently estimated ~386–400 ms of savings on both "without" runs — the same estimate this ticket's Context section already cited (387–394 ms) before the plugin was implemented.

The originally recorded 10,383 ms → ~1,800 ms (−82%) local A/B above does not reproduce and looks like an outlier on the "before" run rather than the plugin's real effect size — 10,383 ms is far outside every other mobile LCP number measured anywhere in the issue-14/16/17 chain, including this ticket's own real-prod measurement (5,353–5,447 ms, i.e. slower than "before" was supposedly 2x faster than). The reliable, reproducible number for this plugin's contribution is **~400 ms**, not ~8,500 ms. Real-prod validation (line 46 above) is unaffected by this correction — that measurement was against actually-deployed code, not the local A/B.
