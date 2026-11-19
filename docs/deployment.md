# Deployment

<!-- How the two-language build ships as static output. Read when touching build/deploy config. -->

One Vite build publishes four static pages to GitHub Pages at `otempora.info`. The URL determines the locale at runtime. [Locale and dataset loading](config-variables.md)

## Build

Run `npm run build --workspace packages/web`. Vite writes four HTML entries and shared JS/CSS assets to `packages/web/dist/`.

- `eager-detail-modulepreload.ts` preloads each timeline’s first two dataset levels for its locale. `landing-timeline-prefetch.ts` writes a per-locale manifest for the timeline page, entry assets and eager datasets. The landing CTA triggers prefetch on hover, focus or touch.
- `critical-font-preload.ts` preloads above-the-fold latin-subset fonts. The timeline uses Archivo 400/600/700 and Fraunces 600. The landing uses Archivo 400 and Fraunces 600. The build sets `font-display: block` for Fontsource faces.
- `prerender-default-viewport.ts` renders landing and timeline markup into `#root` for each locale. The timeline uses the same opening range and fame floors as `App.tsx`. React hydrates the static markup and D3 adopts existing marks using the shared `mark-shape-html.ts` descriptors. [Prerender decision](../packages/web/docs/adr/0013-prerender-default-viewport-for-lcp.md)
- `critical-css.ts` runs after prerendering so Beasties sees the actual markup. It inlines critical CSS and font faces, defers the remaining stylesheet, and force-includes the wrapper rules needed for first layout measurement.

## Profiles

The detail panel fetches `/profiles/<locale>/<slug>.json` when an entity with `hasProfile` opens. The dev server serves the files directly from `packages/shared-types/src/data/profiles/`. When Vite writes the production bundle, `vite-plugins/profiles-static.ts` copies that folder to `dist/profiles/`. GitHub Pages serves the files with `Cache-Control: max-age=600`, so a changed Profile can take up to ten minutes to reach a returning visitor.

## URL structure

English is served from the domain root; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. There is no `/en/` path and no root redirect.

| URL | Entry | Page |
|---|---|---|
| `/` | `index.html` | Landing, English |
| `/ru/` | `ru/index.html` | Landing, Russian |
| `/timeline/` | `timeline/index.html` | Timeline, English |
| `/ru/timeline/` | `ru/timeline/index.html` | Timeline, Russian |

Each route is canonical. `hreflang` pairs the same page kind across locales and points `x-default` to `/`. All four routes are in `public/sitemap.xml` and share `og-image.png`.

A Landing Page language switch preserves the chosen Curiosity hash. The timeline switch in Help carries `?e=<slug>` for the open entity. A Landing Page CTA can also add `#moment-<n>` or `#fact-<n>` to the destination Entity Link.

## 404 page

Both Pages and Vite preview serve `dist/404.html` for unresolved paths. The source in `packages/web/public/404.html` is a self-contained, bilingual, `noindex` page with root-relative links to both timelines. `appType: 'mpa'` preserves real 404 responses.

## CI

`.github/workflows/ci.yml` checks pushes to `dev` and PRs into `main` or `dev`. It lints all packages, typechecks and tests the pipeline and web, and checks web boundaries and production build. The `main` branch requires the checks.

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

After building, run `npm run preview --workspace packages/web -- --port 4173` in a terminal. Use another terminal to check the routes with the local proxy bypassed.

```sh
for path in / /ru/ /timeline/ /ru/timeline/ /anything-else; do
  curl --noproxy '*' -s -o /dev/null -w "$path %{http_code}\n" "http://127.0.0.1:4173$path"
done
```

Expect four `200` responses followed by `404`. In a browser, check the landing CTA, each locale switch and the branded 404 page. Stop preview with Ctrl+C in its terminal.
