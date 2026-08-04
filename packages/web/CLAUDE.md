# packages/web

Frontend: React 19 + TypeScript + Vite + vis-timeline. Reads static JSON (from `packages/shared-types`) bundled at build time — no runtime data fetching.

- Entry Point: `src/main.tsx` (app composition in `src/app/`)

## Build, Test & Verify

Run from repo root:

- Dev server: `npm run dev --workspace packages/web`
- Build: `npm run build --workspace packages/web`
- Preview build: `npm run preview --workspace packages/web`
- Test: `npm run test --workspace packages/web` (Vitest)
- Lint: `npm run lint --workspace packages/web` (ESLint) · `npm run lint:boundaries --workspace packages/web` (Steiger, FSD boundaries)
- Type check: `npm run typecheck --workspace packages/web`

## Code Style & Conventions

- Mini-FSD layering: `shared → features → widgets → app` (no `entities`/`pages`); a layer may only import from layers below it; each slice exposes one public `index.ts`; enforced by Steiger in CI
- CSS Modules only; no hardcoded hex values — colors/spacing come from tokens in `docs/design-tokens.md`
- `Temporal.PlainDate` is canonical everywhere except `toLegacyDate()` in `shared/lib/dates.ts`, called only from `widgets/timeline-canvas/` (see root `CLAUDE.md` — this rule is shared with `packages/data-pipeline`)

## Docs

- `docs/conventions.md` — FSD/React/styling/vis-timeline rules, file organization
- `docs/design-tokens.md` — color palette, typography, radius scale
- `docs/architecture.md` — stack, boundaries, ADR log
- Shared conventions/architecture (apply here too): `../../docs/code-conventions.md` · `../../docs/architecture.md`
