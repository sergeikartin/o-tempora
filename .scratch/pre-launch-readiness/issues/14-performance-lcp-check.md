Type: task
Status: resolved

# Performance: LCP and general audit

## Question

No performance budget or Core Web Vitals check exists anywhere in the repo — nothing in CI, no Lighthouse config, no documented target for LCP on the initial timeline render (which loads the full static JSON dataset and does an initial D3/canvas paint).

Do:
- Run a Lighthouse/Chrome DevTools performance trace against the deployed (or a production build of the) app, on both a representative desktop and throttled-mobile profile.
- Check LCP specifically, plus the other Core Web Vitals (CLS, INP) and overall Lighthouse performance score.
- Identify what's driving LCP (dataset fetch/parse size, initial canvas paint, font loading, etc.) and fix anything clearly cheap to fix (bundle splitting, deferred non-critical work, asset compression).
- Record the baseline numbers and any fixes applied (or explicitly deferred, with why) as this ticket's resolution.

## Resolution

`/grilling` session settled scope before auditing: `chrome-devtools-mcp`'s Lighthouse/trace tools, against deployed prod (`otempora.info`) as primary target with a local production build as fallback, EN only, standard "Good" CWV thresholds, cheap-fixes-only this pass (no D3 rearchitecture, vendor swaps, or service worker/CDN), no CI budget gate yet. Added a `performance.mark('timeline-initial-render')` in `TimelineCanvas.tsx` (fires when the initial real-geometry scroll position commits) since Chrome's native LCP heuristic can't see canvas — it turned out not to matter, see below.

**LCP element**: the native LCP candidate ended up being real content — a `d3-point-name` SVG text label (a person's name) — not an unrelated header/DOM element as suspected going in, so no separate custom metric was needed to represent "meaningful" content.

**Desktop** (`otempora.info`, no throttling): LCP 1,675 ms, CLS 0.00, INP 99 ms (zoom-button click, scripted via `chrome-devtools-mcp`) — all comfortably inside the "Good" thresholds. 99.5% of LCP is "render delay" (JS parse/exec + tier0 fetch/parse + React/D3 initial render), not network wait — TTFB was 5–9 ms throughout.

**Mobile** (local build, Slow 4G + 4x CPU throttle — closest available proxy, see below): LCP 6,931 ms, badly outside "Good" (>2.5s). Same render-delay-dominated breakdown; the page's `load` event fires around 1.5s but the timeline's actual data-driven content doesn't render until ~6.5s, so the gap is overwhelmingly tier0 JSON fetch + main bundle parse/execute under throttling, not any single fixable bug.

**Applied** (cheap, in scope): `people.tier0`/`conflicts.tier0`/`milestones.tier0` datasets were already the load-bearing byte cost here (payload tiering from issue 05 already did the big lift). The one additional win this pass: `DetailPanel` and `AboutPanel` (both closed/empty by default, no first-paint content) are now `React.lazy`-loaded out of `App.tsx`'s main bundle instead of statically imported — trimmed the critical `main.js` chunk by ~2.3 KB gzip and split their CSS out too. Desktop LCP improved 1,683 ms → 1,616 ms on the same build. The saving is proportionally small against mobile's multi-second, fetch-dominated number, but it's a real, zero-risk reduction in what has to parse before first paint.

**Investigated, ruled out as non-issues**:
- `import * as d3 from 'd3'` (full meta-package) — confirmed via bundle inspection that unused D3 submodules (`d3-geo`, `d3-force`, `d3-contour`, etc.) are already tree-shaken out; not a real bloat source.
- Font loading — `@fontsource`'s shipped CSS already sets `font-display: swap`; no blocking-font fix available.
- Third-party script (Umami analytics) — negligible (668 B transfer, 13 ms main-thread).
- RU locale doesn't ship a larger/different font payload than EN — Archivo has no Cyrillic subset at all (an upstream font-family limit, not a packaging gap), so Cyrillic text renders in a fallback font regardless. Not fixable within this pass's scope (would mean swapping typefaces) and not a performance issue either way.

**Deferred — flagged as the highest-value next step, not attempted here**: the render-blocking `main.css` stylesheet costs an estimated ~1,010 ms of LCP/FCP under throttled mobile (per `chrome-devtools-mcp`'s RenderBlocking insight) — the single largest concrete lever found. Fixing it properly means extracting genuinely-critical CSS to inline in `<head>` and deferring the rest, which for this app's CSS-Modules-per-widget architecture (and layout-measurement JS that depends on CSS being applied synchronously — see `TimelineCanvas.tsx`'s `container.clientWidth` reads) is real engineering, not a cheap five-minute change, and risks visual regressions across two locales and both layouts if done hastily. Worth its own future ticket.

**Caveat on the mobile number**: `chrome-devtools-mcp`'s Slow-4G + 4x-CPU-throttle emulation is a client-side approximation, not a measurement of `otempora.info`'s actual GitHub Pages/Fastly CDN behavior on a real device — but the finding (render delay dominated by fetch+parse of tier0 JS/JSON under constrained bandwidth/CPU, not by any single bug) should hold regardless of exact numbers.

No CI/Lighthouse budget gate added (deferred, per the grilling session — needs this baseline to calibrate against). Recorded here only, no new `docs/performance.md`.
