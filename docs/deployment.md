# Deployment

<!-- How the two-language build ships as static output. Read when touching build/deploy config. -->

One build, two languages, resolved at runtime from the URL (`packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`) — no server-side logic, no per-language build fork. Hosted on GitHub Pages at `otempora.info` (`docs/adr/0003-english-served-from-domain-root.md`).

## Building

From `packages/web`: `npm run build` → `dist/`.

`vite.config.ts` uses Vite's multi-page-app support — `index.html` and `ru/index.html` are two Rollup inputs loading the same `/src/main.tsx` — so this single `vite build` emits both `dist/index.html` and `dist/ru/index.html`, sharing the same `dist/assets/*` JS/CSS chunks. Which language actually renders, and which dataset chunks that locale fetches, is decided in the browser — see `docs/config-variables.md` for the locale-resolution and Detail Level loading mechanism; a given page load only ever fetches one language's dataset, never both.

Because that dataset fetch happens behind a runtime locale branch rather than a statically-reachable import, Vite doesn't auto-preload those chunks. Two small build-time plugins (`vite-plugins/eager-detail-modulepreload.ts`, `vite-plugins/critical-font-preload.ts`) read the build's output bundle in `transformIndexHtml` and inject `<link>` tags per HTML entry: `modulepreload` for that entry's own locale's eagerly-loaded Detail Level chunks (never the other locale's), and `preload` for the `@fontsource/archivo` 400/700 latin-subset `.woff2` files — the weights used by the timeline lane labels, year-axis ticks, and century tab on both locale pages. Since GitHub Pages serves one static HTML file to every visitor, the (desktop-only-visible) Sidebar's Fraunces/Archivo 600 is deliberately left unpreloaded even though it's also above the fold there — mobile is the platform this optimizes for, and mobile LCP is what the preload budget is spent on.

A third plugin, `vite-plugins/prerender-default-viewport.ts`, server-renders `<App initialDatasets={...} />` for each HTML entry's own locale and seeds `index.html`/`ru/index.html`'s `#root` with the real default-viewport markup — People/Conflicts+Milestones marks and the Year Axis, for the same `DEFAULT_VIEWPORT_START_YEAR`–`DEFAULT_VIEWPORT_END_YEAR`/fame-score-floor state `App.tsx` already initializes from (`packages/web/docs/adr/0013-prerender-default-viewport-for-lcp.md`) — so first paint shows real content before any JS runs. `main.tsx` hydrates rather than mounting fresh; `PeopleLane`/`ConflictsMilestonesLane` seed their D3-owned `<g>` containers' initial content via a frozen `dangerouslySetInnerHTML` (same shape descriptor as the live D3 join, `mark-shape-html.ts`) so hydration has nothing to reconcile there, and the D3 join then adopts those nodes instead of recreating them.

A fourth plugin, `vite-plugins/critical-css.ts`, inlines above-the-fold CSS into each HTML entry's `<head>` (via `beasties`) and defers the rest with a `media="print"`/`onload` swap, registered after the prerender step above so Beasties' DOM-presence heuristic sees the real class-bearing markup, not an empty shell. The layout rules `TimelineCanvas`'s post-mount `container.clientWidth` measurement depends on (`.wrapper`/`.scrollContainer`, CSS-Modules-mangled to `._wrapper_<hash>_<n>` etc.) are still force-included via `allowRules` regardless, since that measurement effect's own layout needs are independent of whatever marks happen to be prerendered.

## URL structure

English is served from the domain root; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. There is no `/en/` path and no root redirect (`docs/adr/0003`).

## CI

`.github/workflows/ci.yml` runs on every push to `dev` and every PR into `main`/`dev`: typecheck + test for `data-pipeline`, and lint + `lint:boundaries` + typecheck + test + build for `web`. Branch protection on `main` requires both jobs to pass before merge.

## Deploying

`dev` is the working branch; PRs merge into `main`, and `.github/workflows/deploy.yml` builds and deploys to GitHub Pages automatically on every push to `main` (or via manual `workflow_dispatch`). It writes a `CNAME` file (`otempora.info`) into `packages/web/dist/` so the custom domain survives each deploy, then publishes that directory through `actions/upload-pages-artifact` + `actions/deploy-pages`.

One-time manual setup (not repo config — done once in GitHub's UI and at the domain registrar):

- Repo Settings → Pages → Source: "GitHub Actions".
- Repo Settings → Pages → Custom domain: `otempora.info`; enable "Enforce HTTPS" once GitHub finishes issuing the certificate.
- At the registrar for `otempora.info` (DNS managed directly there, no Cloudflare — `docs/adr/` grilling session), add apex `A` records pointing at GitHub Pages:
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

Each page carries a visible link to the sibling locale's default (home) view — `packages/web/src/widgets/sidebar/ui/Sidebar.tsx`'s language switcher, `/` ↔ `/ru/`, root-relative so it works regardless of domain. No deep-link/viewport-state preservation across the switch (spec's Out of Scope).

## Verifying locally

```
cd packages/web
npm run build
cd dist && python3 -m http.server 8000
```

Then check `http://localhost:8000/` and `http://localhost:8000/ru/` both load, and the switcher link on each navigates to the other.
