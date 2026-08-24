# Deployment

<!-- How the two-language build ships as static output. Read when touching build/deploy config. -->

One build, two languages, resolved at runtime from the URL (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`) — no server-side logic, no per-language build fork. Hosted on GitHub Pages at `otempora.info` (`docs/adr/0003-english-served-from-domain-root.md`).

## Building

From `packages/web`: `npm run build` → `dist/`.

`vite.config.ts` uses Vite's multi-page-app support — `index.html` and `ru/index.html` are two Rollup inputs loading the same `/src/main.tsx` — so this single `vite build` emits both `dist/index.html` and `dist/ru/index.html`, sharing the same `dist/assets/*` JS/CSS chunks. Which language actually renders is decided in the browser: Paraglide's `url` strategy reads the request path (`/` vs `/ru/`) to pick the locale, and `src/app/locale-datasets.ts` dynamically imports that locale's `people.tier0.json`/`conflicts.tier0.json`/`milestones.tier0.json` eagerly, plus the `.tier1` siblings deferred to idle time (requires `packages/shared-types/src/data/{people,conflicts,milestones}.tier{0,1}.ru.json` to already exist for the Russian path — see `packages/data-pipeline/CLAUDE.md`'s fetch step) — a given page load only ever fetches one language's dataset, never both.

Because that tier0 fetch happens behind a runtime locale branch rather than a statically-reachable import, Vite doesn't auto-preload those chunks. Two small build-time plugins (`vite-plugins/tier0-modulepreload.ts`, `vite-plugins/critical-font-preload.ts`) read the build's output bundle in `transformIndexHtml` and inject `<link>` tags per HTML entry: `modulepreload` for that entry's own locale's three tier0 chunks (never the other locale's), and `preload` for the `@fontsource/archivo` 400/700 latin-subset `.woff2` files — the weights used by the timeline lane labels, year-axis ticks, and century tab on both locale pages. Since GitHub Pages serves one static HTML file to every visitor, the (desktop-only-visible) Sidebar's Fraunces/Archivo 600 is deliberately left unpreloaded even though it's also above the fold there — mobile is the platform this optimizes for, and mobile LCP is what the preload budget is spent on.

A third plugin, `vite-plugins/critical-css.ts`, inlines above-the-fold CSS into each HTML entry's `<head>` (via `beasties`) and defers the rest with a `media="print"`/`onload` swap. `beasties` decides what's critical by matching selectors against the given HTML's DOM, but this app's build-time HTML is a bare CSR shell with nothing rendered into it — so the layout rules `TimelineCanvas`'s post-mount `container.clientWidth` measurement depends on (`.wrapper`/`.scrollContainer`, CSS-Modules-mangled to `._wrapper_<hash>_<n>` etc.) are force-included via `allowRules` rather than left to that DOM-presence heuristic.

## URL structure

English is served from the domain root; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. There is no `/en/` path and no root redirect (`docs/adr/0003`).

## Deploying

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages automatically on every push to `main` (or via manual `workflow_dispatch`). It writes a `CNAME` file (`otempora.info`) into `packages/web/dist/` so the custom domain survives each deploy, then publishes that directory through `actions/upload-pages-artifact` + `actions/deploy-pages`.

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
