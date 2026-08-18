# Deployment

<!-- How the two-language build ships as static output. Read when touching build/deploy config. -->

One build, two languages, resolved at runtime from the URL (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`) — no server-side logic, no per-language build fork. Hosted on GitHub Pages at `otempora.info` (`docs/adr/0003-english-served-from-domain-root.md`).

## Building

From `packages/web`: `npm run build` → `dist/`.

`vite.config.ts` uses Vite's multi-page-app support — `index.html` and `ru/index.html` are two Rollup inputs loading the same `/src/main.tsx` — so this single `vite build` emits both `dist/index.html` and `dist/ru/index.html`, sharing the same `dist/assets/*` JS/CSS chunks. Which language actually renders is decided in the browser: Paraglide's `url` strategy reads the request path (`/` vs `/ru/`) to pick the locale, and `src/app/locale-datasets.ts` dynamically imports that locale's `people.json`/`conflicts.json`/`milestones.json` (requires `packages/shared-types/src/data/{people,conflicts,milestones}.ru.json` to already exist for the Russian path — see `packages/data-pipeline/CLAUDE.md`'s fetch step) — a given page load only ever fetches one language's dataset, never both.

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
