# packages/web

Frontend: React 19 + TypeScript + Vite + D3. Reads static JSON (from `packages/shared-types`) bundled at build time — no live/changing data, though each lane's dataset loads as two build-time-bundled chunks (Payload Tier's Tier 0/Tier 1, `docs/config-variables.md`) fetched over the network at different times rather than one inlined blob.

- Entry Point: `src/main.tsx` (app composition in `src/app/`)

## Build, Test & Verify

Run from repo root:

- Dev server: `npm run dev --workspace packages/web`
- Build: `npm run build --workspace packages/web`
- Preview build: `npm run preview --workspace packages/web`
- Test: `npm run test --workspace packages/web` (Vitest)
- Lint: `npm run lint --workspace packages/web` (Biome) · `npm run lint:boundaries --workspace packages/web` (Steiger, FSD boundaries)
- Type check: `npm run typecheck --workspace packages/web`


## Stack

| Layer | Technology |
|---|---|
| UI framework | React + TypeScript, mini-FSD |
| Build tool | Vite |
| Timeline rendering | D3 |
| Styling | CSS Modules |
| Testing | Vitest + RTL |
| Lint / format / boundary tooling | Biome (lint + format, incl. a11y rules) + Steiger, enforcing mini-FSD boundaries |

## Docs

- `docs/code-conventions.md` — FSD/React/styling rules, file organization
- `docs/design-tokens.md` — color palette, typography, radius scale
- `docs/adr/` — architecture decision records

