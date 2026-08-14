# Deployment

<!-- How the two language builds ship as static output. Read when touching build/deploy config. -->

Two fully independent static builds, English and Russian (`.scratch/russian-localization/spec.md`) — no runtime language toggle, no shared server-side logic between them.

## Building

From `packages/web`:

- `npm run build:en` → `dist/en/` (also just `npm run build`, the default)
- `npm run build:ru` → `dist/ru/` (requires `packages/shared-types/src/data/{people,conflicts,milestones}.ru.json` to already exist — see `packages/data-pipeline/CLAUDE.md`'s fetch step)

Each build's `vite.config.ts` `base` is set to its own subpath (`/en/`, `/ru/`), so asset URLs baked into that build's `index.html`/JS are correct once deployed.

## Deploying

`dist/en/` and `dist/ru/` are already shaped for a subpath deployment: upload both directories as-is to any static host so they're reachable as `<domain>/en/` and `<domain>/ru/` respectively (e.g. object storage + CDN, or a static-hosting provider's multi-directory/rewrite support — no specific provider is prescribed here). A request to the bare domain root has no required behavior yet; redirecting it to `/en/` as the default landing view is a reasonable choice but not implemented.

Each build carries a visible link to the sibling build's default (home) view — `packages/web/src/widgets/sidebar/ui/Sidebar.tsx`'s language switcher, `/en/` ↔ `/ru/`, root-relative so it works regardless of domain. No deep-link/viewport-state preservation across the switch (spec's Out of Scope).

## Verifying locally

```
cd packages/web
npm run build:en && npm run build:ru
cd dist && python3 -m http.server 8000
```

Then check `http://localhost:8000/en/` and `http://localhost:8000/ru/` both load, and the switcher link on each navigates to the other.
