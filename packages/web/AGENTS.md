# packages/web

Frontend: React 19 + TypeScript + Vite + D3. Reads static JSON (from `packages/shared-types`) — no live/changing data. Each lane's dataset loads as 4 build-time-bundled chunks (Detail Level's per-level delta files, `docs/config-variables.md`) fetched over the network at different times rather than one inlined blob. An entity with `hasProfile` loads its static `profiles/<locale>/<slug>.json` from the same origin when opened (`docs/adr/0018-profiles-are-fetched-at-runtime-as-static-json.md`).

- Entry Points: `src/main.tsx` (timeline; app composition in `src/app/`) and `src/landing.tsx` (landing page, `src/app/landing/`)

## Build, Test & Verify

Scripts are in `package.json`; run them from the repo root with `--workspace packages/web`. Not obvious from there:

- Biome's config root is `packages/web`: invoke it through `npm run lint` / `lint:fix`, never via `npx biome` from another directory (it errors with "nested root configuration").
- Typecheck with `npm run typecheck` (`tsc -b`). `tsc --noEmit` checks nothing here: the root tsconfig is solution-style.
- The pre-commit hook (`.husky/pre-commit`) runs Biome on staged files, then typecheck and boundary checks (`lint:boundaries`, Steiger) for the packages you touched. Tests run in CI, so run `npm run test` yourself.
- `npm run a11y` runs axe at 1440/768/390 in both locales across the timeline, Filters Panel, Help and an open entity; it fails on anything not in `scripts/a11y-baseline.json`. Not in CI.
- `npm run shot -- --width 390 --step tap:100,170 --step eval:<js>` screenshots the built app (see `scripts/shot.mjs`); use it to check a UI change in the real app. `a11y` and `shot` need `npx playwright install chromium` once.

## Docs

- `docs/code-conventions.md` — FSD/React/styling rules, file organization
- `docs/timeline-rendering.md` — D3 timeline rendering mechanics (lanes, zoom, row assignment, Year Axis)
- `docs/design-tokens.md` — color palette, typography, radius scale
- `docs/adr/` — architecture decision records

