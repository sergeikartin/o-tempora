# Deployment

<!-- How the two language builds ship as static output. Read when touching build/deploy config. -->

Two fully independent static builds, English and Russian (`.scratch/russian-localization/spec.md`) — no runtime language toggle, no shared server-side logic between them. Hosted on GitHub Pages at `otempora.info` (`docs/adr/0003-english-served-from-domain-root.md`).

## Building

From `packages/web`:

- `npm run build:en` → `dist/` (also just `npm run build`, the default)
- `npm run build:ru` → `dist/ru/` (requires `packages/shared-types/src/data/{people,conflicts,milestones}.ru.json` to already exist — see `packages/data-pipeline/CLAUDE.md`'s fetch step)

Run `build:en` before `build:ru` when producing both — `build:en`'s `vite build` clears `dist/` before writing English's output; `build:ru` only clears `dist/ru/`, leaving English's files at `dist/` root untouched.

Each build's `vite.config.ts` `base` matches where it's served: `/` for English, `/ru/` for Russian, so asset URLs baked into that build's `index.html`/JS resolve correctly once deployed.

## URL structure

English is served from the domain root; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. There is no `/en/` path and no root redirect (`docs/adr/0003`).

## Deploying

`.github/workflows/deploy.yml` builds both locales and deploys to GitHub Pages automatically on every push to `main` (or via manual `workflow_dispatch`). It writes a `CNAME` file (`otempora.info`) into the merged `packages/web/dist/` output so the custom domain survives each deploy, then publishes that directory through `actions/upload-pages-artifact` + `actions/deploy-pages`.

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

Each build carries a visible link to the sibling build's default (home) view — `packages/web/src/widgets/sidebar/ui/Sidebar.tsx`'s language switcher, `/` ↔ `/ru/`, root-relative so it works regardless of domain. No deep-link/viewport-state preservation across the switch (spec's Out of Scope).

## Verifying locally

```
cd packages/web
npm run build:en && npm run build:ru
cd dist && python3 -m http.server 8000
```

Then check `http://localhost:8000/` and `http://localhost:8000/ru/` both load, and the switcher link on each navigates to the other.
