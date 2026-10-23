# Deployment

<!-- How the two-language build ships as static output. Read when touching build/deploy config. -->

One build, two languages, resolved at runtime from the URL (`packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`) — no server-side logic, no per-language build fork. Hosted on GitHub Pages at `otempora.info` (`docs/adr/0007-landing-and-timeline-split-into-four-routes.md`).

## Building

From `packages/web`: `npm run build` → `dist/`.

`vite.config.ts` uses Vite's multi-page-app support — four Rollup inputs per the table under URL structure: the two landing entries load `/src/landing.tsx`, the two timeline entries load `/src/main.tsx` — so this single `vite build` emits all four HTML files, sharing `dist/assets/*` JS/CSS chunks. Which language actually renders, and which dataset chunks that locale fetches, is decided in the browser — see `docs/config-variables.md` for the locale-resolution and Detail Level loading mechanism; a given timeline page load only ever fetches one language's dataset, never both, and a landing page fetches none.

Because that dataset fetch happens behind a runtime locale branch rather than a statically-reachable import, Vite doesn't auto-preload those chunks. Build-time plugins read the build's output bundle in `transformIndexHtml` and inject tags per HTML entry, telling the four entries apart by path (`vite-plugins/html-entry.ts`). `vite-plugins/eager-detail-modulepreload.ts` adds `modulepreload` for a timeline entry's own locale's eagerly-loaded Detail Level chunks (never the other locale's, never on a landing entry). `vite-plugins/critical-font-preload.ts` adds `preload` for the `@fontsource` latin-subset `.woff2` faces each entry kind renders above the fold: Archivo 400/600/700 and Fraunces 600 on the timeline, only Archivo 400 and Fraunces 600 on the landing. `vite-plugins/landing-timeline-prefetch.ts` writes each landing entry's `<script type="application/json" id="timeline-prefetch">` listing the timeline page, its entry chunk and static imports, stylesheet and that locale's eager datasets; `src/app/landing/prefetch-timeline.ts` turns it into `<link rel="prefetch">` tags only on call-to-action hover, focus or touch. Since GitHub Pages serves one static HTML file to every visitor, the (desktop-only-visible) Sidebar's Fraunces/Archivo 600 is deliberately left unpreloaded even though it's also above the fold there — mobile is the platform this optimizes for, and mobile LCP is what the preload budget is spent on.

The `@font-face` rules are inlined into the page's critical CSS (`vite-plugins/critical-css.ts`) so the preloaded fonts are bound to their families at first paint, and every `@fontsource` face is built with `font-display: block` (a small `vite.config.ts` plugin) so text appears once in its real face rather than in the system fallback first.

A further plugin, `vite-plugins/prerender-default-viewport.ts`, server-renders `<App initialDatasets={...} />` for each timeline entry's own locale and seeds `timeline/index.html`/`ru/timeline/index.html`'s `#root` with the real default-viewport markup — People/Conflicts+Milestones marks and the Year Axis, for the same `DEFAULT_VIEWPORT_START_YEAR`–`DEFAULT_VIEWPORT_END_YEAR`/fame-score-floor state `App.tsx` already initializes from (`packages/web/docs/adr/0013-prerender-default-viewport-for-lcp.md`) — so first paint shows real content before any JS runs. The landing entries are prerendered the same way from `<LandingPage />` (no datasets, no scroll pin). `main.tsx` and `landing.tsx` hydrate rather than mounting fresh; `PeopleLane`/`ConflictsMilestonesLane` seed their D3-owned `<g>` containers' initial content via a frozen `dangerouslySetInnerHTML` (same shape descriptor as the live D3 join, `mark-shape-html.ts`) so hydration has nothing to reconcile there, and the D3 join then adopts those nodes instead of recreating them.

The last plugin, `vite-plugins/critical-css.ts`, inlines above-the-fold CSS into each HTML entry's `<head>` (via `beasties`) and defers the rest with a `media="print"`/`onload` swap, registered after the prerender step above so Beasties' DOM-presence heuristic sees the real class-bearing markup, not an empty shell. The layout rules `TimelineCanvas`'s post-mount `container.clientWidth` measurement depends on (`.wrapper`/`.scrollContainer`, CSS-Modules-mangled to `._wrapper_<hash>_<n>` etc.) are still force-included via `allowRules` regardless, since that measurement effect's own layout needs are independent of whatever marks happen to be prerendered.

## URL structure

English is served from the domain root; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. There is no `/en/` path and no root redirect.

| URL | Entry | Page |
|---|---|---|
| `/` | `index.html` | Landing, English |
| `/ru/` | `ru/index.html` | Landing, Russian |
| `/timeline/` | `timeline/index.html` | Timeline, English |
| `/ru/timeline/` | `ru/timeline/index.html` | Timeline, Russian |

Each page is its own canonical. `hreflang` pairs landing with landing and timeline with timeline, with `x-default` pointing at `/`. Entity Links (`?e=<slug>`) live on the timeline routes and canonicalise to `/timeline/`. `public/sitemap.xml` lists the four URLs and `og-image.png` is shared by all of them.

Each page carries a visible link to the sibling locale's same page kind — the landing's nav (`/` ↔ `/ru/`) and `packages/web/src/widgets/sidebar/ui/Sidebar.tsx`'s language switcher (`/timeline/` ↔ `/ru/timeline/`), root-relative so they work regardless of domain. When an entity is open the timeline's link carries its `?e=<slug>` to the sibling; nothing else (viewport, Detail Level, filters) is preserved across the switch. The landing's link likewise carries the chosen curiosity's `#<id>` hash to the sibling landing.

## 404 page

`packages/web/public/404.html` is a static, bilingual (EN + RU on one page) parchment-styled page with inline CSS and no JS or datasets; Vite copies it to `dist/404.html`, which GitHub Pages serves (with a 404 status) for any path that isn't a real file. It links to `/timeline/` and `/ru/timeline/` root-relatively, so it works from any depth, and it is `noindex`. The Ledger & Ink tokens are repeated inline since it loads no bundle, and fonts fall back to system faces. `vite.config.ts` sets `appType: 'mpa'` (no SPA fallback to `index.html`) and a small preview-only plugin serves `404.html` for unresolved paths, so `npm run preview` behaves like Pages.

## CI

`.github/workflows/ci.yml` runs on every push to `dev` and every PR into `main`/`dev`: typecheck + test for `data-pipeline`, and lint + `lint:boundaries` + typecheck + test + build for `web`. Branch protection on `main` requires both jobs to pass before merge.

## Deploying

`dev` is the working branch; PRs merge into `main`, and `.github/workflows/deploy.yml` builds and deploys to GitHub Pages automatically on every push to `main` (or via manual `workflow_dispatch`). It writes a `CNAME` file (`otempora.info`) into `packages/web/dist/` so the custom domain survives each deploy, then publishes that directory through `actions/upload-pages-artifact` + `actions/deploy-pages`.

One-time manual setup (not repo config — done once in GitHub's UI and at the domain registrar):

- Repo Settings → Pages → Source: "GitHub Actions".
- Repo Settings → Pages → Custom domain: `otempora.info`; enable "Enforce HTTPS" once GitHub finishes issuing the certificate.
- At the registrar for `otempora.info` (DNS is managed directly there), add apex `A` records pointing at GitHub Pages:
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```
  Optionally `AAAA` records for IPv6:
  ```
  2606:50c0:8000::153
  2606:50c0:8001::153
  2606:50c0:8002::153
  2606:50c0:8003::153
  ```

## Verifying locally

`npm run preview` serves `dist/` the way Pages does, including the 404 page for unknown paths (`http.server` would not). Run it detached so the shell call returns, and curl `127.0.0.1` with the proxy bypassed — agent and CI shells often set `http_proxy`, which turns every `localhost` request into a 502:

```
npm run build --workspace packages/web
cd packages/web && (setsid npx vite preview --port 4173 >/dev/null 2>&1 </dev/null &)
for p in / /ru/ /timeline/ /ru/timeline/ /anything-else; do curl --noproxy '*' -s -o /dev/null -w "$p %{http_code}\n" http://127.0.0.1:4173$p; done
```

Expect `200` four times, then `404`. In a browser, check that the call-to-action opens the timeline, that the language switcher on each page navigates to the sibling locale's same page kind, and that the unknown path shows the branded 404 page.

Stop the server by PID — `kill $(ss -ltnp | rg ':4173' | rg -o 'pid=[0-9]+' | cut -d= -f2)`. `pkill -f "vite preview"` also matches the invoking shell's own command line and kills it.
