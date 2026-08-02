# Spec: Project Scaffold (Frontend) — Unit 3

## Goal

Scaffold `packages/web` as a Vite + React + TypeScript app with the
mini-FSD folder skeleton (`shared/`, `features/`, `widgets/`, `app/`)
and Steiger boundary enforcement wired up, so there is a blank app
that runs in the browser and passes lint/type/boundary checks before
Unit 4 puts real data and rendering behind it.

## Assumptions flagged (per `ai-workflow-rules.md`, stated rather than silently decided)

1. **Package name:** `packages/shared-types/package.json` uses the
   scoped form `@same-sky/shared-types`; `packages/data-pipeline`
   predates workspaces and kept the unscoped `same-sky-data-pipeline`.
   Since `packages/web` is new, it follows the scoped convention:
   `@same-sky/web`. This is cosmetic, not architectural — flagging it
   in case you'd rather match `data-pipeline`'s form instead.
2. **`app/` gets real (minimal) content, not just a placeholder.**
   The build plan (`00-build-plan.md`, Unit 3) says all four layers get
   "a placeholder `index.ts`." `shared/`, `features/`, and `widgets/`
   do — there's nothing to build yet, since no slice exists before
   Unit 4+. But `app/` is what has to actually render something for
   "a blank app that runs in the browser" to be true, so it gets a
   real `App.tsx` (a static placeholder heading, no business logic)
   plus a real `index.ts` re-export. This is a clarification of the
   build plan's wording, not a scope addition.
3. **Vitest is installed in this unit, per your instruction**, ahead
   of where `00-build-plan.md`'s own Unit 3 deliverable list would
   have placed it (it names ESLint and Steiger but not Vitest). Since
   there's no filter/date logic yet to unit test, the one test this
   unit adds exercises the only real piece of behavior that exists:
   `App` rendering its placeholder heading. `@testing-library/react`
   and `jsdom` come with it (needed to render a component and assert
   on it); `@testing-library/jest-dom` is left out for now — the one
   test uses plain `textContent` assertions, so the extra matcher
   library has nothing to earn its keep on yet.
4. **No CI workflow file is added in this unit.** `code-standards.md`
   says Steiger "is run in CI on every PR," but wiring an actual
   GitHub Actions workflow isn't in Unit 3's deliverable list and
   there's no existing CI config in the repo to extend. This unit
   makes Steiger runnable locally (`npm run lint:boundaries`); wiring
   it into CI is a separate, explicit piece of work.
5. **`architecture.md`'s Stack table has no row for the lint/boundary
   tooling** (ESLint, Steiger) even though `code-standards.md` already
   commits to Steiger by name. Per `ai-workflow-rules.md` ("if a unit
   adds a new top-level dependency, add a row to the Stack table in
   the same unit"), this unit adds that row — see Implementation
   step 6.

## Design

### Folder shape (mini-FSD, per `code-standards.md`)

```
packages/web/
├── package.json
├── tsconfig.json          # solution file, references only
├── tsconfig.app.json       # src/ — DOM lib, strict
├── tsconfig.node.json      # vite.config.ts / eslint.config.js / steiger.config.ts — Node lib
├── vite.config.ts
├── eslint.config.js
├── steiger.config.ts
├── index.html
├── .gitignore
└── src/
    ├── main.tsx            # true entry point — outside the FSD layer stack itself
    ├── vite-env.d.ts
    ├── shared/
    │   └── index.ts        # placeholder — populated from Unit 4 (types, lib, config, ui)
    ├── features/
    │   └── index.ts        # placeholder — populated from Unit 6 (select-timeline-entity) onward
    ├── widgets/
    │   └── index.ts        # placeholder — populated from Unit 4 (timeline-canvas) onward
    └── app/
        ├── index.ts        # public API: re-exports App
        ├── App.tsx          # minimal placeholder UI (see below)
        ├── App.test.tsx     # the one test this unit adds
        └── global.css       # base reset only — no design tokens yet (that's Unit 5)
```

No subfolders inside `shared/`, `features/`, or `widgets/` are created
yet (no `shared/lib/`, no `features/filter-by-fame-tier/`, etc.) —
those appear only when the unit that needs them is built, per
`ai-workflow-rules.md`'s "don't build beyond the current unit of
work." `code-standards.md`'s File Organization section already
describes that eventual structure prescriptively, so it needs no edit
for this unit.

### What renders

`App.tsx` renders a static placeholder — the app title text (e.g.
"World History Timeline") in a full-viewport centered div — enough to
visibly confirm the scaffold works in a browser. No timeline, no
data, no design tokens (`ui-context.md`'s colors/type are Unit 5's
job). `global.css` is a plain reset (`box-sizing`, margin/padding
zero, `height: 100%` on `html`/`body`/`#root`) — not the `ui-context.md`
palette.

### FSD boundary enforcement

Steiger + `@feature-sliced/steiger-plugin`'s `recommended` config,
unmodified — `code-standards.md` already notes the recommended
ruleset tolerates the omitted `entities`/`pages` layers, so no
rule-disabling is needed. Config lives at
`packages/web/steiger.config.ts`, run against `./src`.

## Implementation

Build in this order:

1. **`package.json`** — scoped name `@same-sky/web` (see Assumption
   1), `"type": "module"`, `engines.node` matching
   `data-pipeline`'s `>=22.21.0` floor. Scripts:
   - `dev`: `vite`
   - `build`: `tsc -b && vite build`
   - `preview`: `vite preview`
   - `typecheck`: `tsc -b`
   - `lint`: `eslint .`
   - `lint:boundaries`: `steiger ./src`
   - `test`: `vitest run`
   Dependencies: `react`, `react-dom`, `@same-sky/shared-types`
   (workspace dep — not used yet, but the package boundary is
   established now so Unit 4 doesn't need a `package.json` edit to
   add it). Dev dependencies: `@vitejs/plugin-react`, `vite`,
   `eslint`, `typescript-eslint`, `@eslint/js`,
   `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
   `globals`, `steiger`, `@feature-sliced/steiger-plugin`, `vitest`,
   `@testing-library/react`, `jsdom`. Exact versions in Dependencies
   section below.

2. **TypeScript config** — three files (solution + app + node split,
   standard for a Vite app that also type-checks its own Node-side
   config files): `tsconfig.json` references `tsconfig.app.json` and
   `tsconfig.node.json`; both leaf configs set `strict: true`,
   `noUncheckedIndexedAccess: true`, `skipLibCheck: true`,
   `esModuleInterop: true` — matching `data-pipeline/tsconfig.json`'s
   strictness posture. `tsconfig.app.json` adds `"lib": ["ES2022",
   "DOM", "DOM.Iterable"]`, `"jsx": "react-jsx"`, `"types":
   ["vite/client"]`, `include: ["src"]`. `tsconfig.node.json` adds
   `"lib": ["ES2022"]`, `"types": ["node"]`, `include:
   ["vite.config.ts", "eslint.config.js", "steiger.config.ts"]`.

3. **`vite.config.ts`** — `defineConfig` imported from `vitest/config`
   (a superset of `vite`'s `defineConfig` that also types the `test`
   key), `plugins: [react()]` via `@vitejs/plugin-react`, plus
   `test: { environment: 'jsdom' }` so `App.test.tsx` can render into a
   DOM. No path aliases — out of scope for this unit.

4. **`index.html`** — standard Vite shell: `<div id="root">`, page
   `<title>World History Timeline</title>`, no font `<link>` tags yet
   (Fraunces/Inter/IBM Plex Mono are Unit 5's job per `ui-context.md`).

5. **`eslint.config.js`** — flat config (required by ESLint 10):
   `js.configs.recommended` + `tseslint.configs.strict`, React Hooks
   rules via `eslint-plugin-react-hooks`'s recommended config, and
   `eslint-plugin-react-refresh`'s `only-export-components` rule
   (`allowConstantExport: true`, since `app/index.ts` re-exports a
   constant). Scoped to `**/*.{ts,tsx}`, `dist` ignored.

6. **`steiger.config.ts`** — `defineConfig([...fsd.configs.recommended])`
   from `@feature-sliced/steiger-plugin`, no overrides. Also, in this
   same step, add a row to `architecture.md`'s Stack table for the
   lint/boundary tooling (ESLint + typescript-eslint + Steiger +
   `@feature-sliced/steiger-plugin`) — see Assumption 5.

7. **Mini-FSD skeleton** — create `src/shared/index.ts`,
   `src/features/index.ts`, `src/widgets/index.ts`, each containing
   only:
   ```ts
   export {};
   ```
   (keeps the file a real ES module with nothing to export yet).
   Create `src/app/index.ts` (`export { App } from './App';`),
   `src/app/App.tsx` (the placeholder heading described in Design),
   and `src/app/global.css` (the plain reset described in Design).

8. **`src/main.tsx`** — the actual React root: imports `App` from
   `./app` (the layer's public API, never `./app/App` directly, per
   `code-standards.md`'s "each slice exposes a single public entry
   point" rule extended here to the layer's own index), imports
   `./app/global.css`, calls `createRoot(document.getElementById('root')!).render(<App />)`.

9. **`src/app/App.test.tsx`** — the one test this unit adds. Uses
   `@testing-library/react`'s `render` to mount `<App />` into jsdom,
   then asserts the placeholder heading text is present via plain
   `container.textContent` / `screen.getByText` assertions (no
   `@testing-library/jest-dom` matchers — see Assumption 3):
   ```tsx
   import { render, screen } from '@testing-library/react';
   import { test, expect } from 'vitest';
   import { App } from './App';

   test('renders the placeholder heading', () => {
     render(<App />);
     expect(screen.getByText('World History Timeline')).toBeTruthy();
   });
   ```

10. **`.gitignore`** — `node_modules/` and `dist/`, matching
    `data-pipeline/.gitignore`'s pattern (redundant with the root
    `.gitignore` but consistent with the existing per-package
    convention).

11. **Verify locally**: `npm install` from repo root, then from
    `packages/web/`: `npm run typecheck`, `npm run lint`, `npm run
    lint:boundaries`, `npm run test`, `npm run build`, and `npm run
    dev` — confirm the placeholder heading actually renders in a
    browser at the printed localhost URL.

12. **Update `progress-tracker.md`**: mark Unit 3 complete, log the
    real dependency versions installed and the five assumptions above,
    per `CLAUDE.md`'s "update after each meaningful implementation
    change" and `ai-workflow-rules.md`'s "same unit of work" rule.

## Dependencies

New packages for `packages/web` only (`data-pipeline` and
`shared-types` are untouched — this unit doesn't cross that boundary,
per `ai-workflow-rules.md`). Versions below are the current latest as
of this spec (verified against the npm registry):

| Package | Version | Why |
|---|---|---|
| `react` | `^19.2.8` | UI framework, per `architecture.md`'s Stack table |
| `react-dom` | `^19.2.8` | React's DOM renderer |
| `@same-sky/shared-types` | `^0.1.0` (workspace) | Package boundary established now; first real import is Unit 4 |
| `vite` | `^8.2.0` | Build tool, per Stack table |
| `@vitejs/plugin-react` | `^6.0.5` | Vite's React plugin (JSX transform, Fast Refresh) — implied by "React + Vite" but not itself named in the Stack table; flagging it as the standard companion package rather than a separate architectural choice |
| `eslint` | `^10.8.0` | Named directly in `00-build-plan.md`'s Unit 3 deliverables |
| `typescript-eslint` | `^8.65.0` | TS-aware linting, needed for `eslint.config.js` to understand `.ts`/`.tsx` |
| `@eslint/js` | `^10.0.1` | ESLint's own recommended flat-config base |
| `eslint-plugin-react-hooks` | `^7.1.1` | Standard React Hooks lint rules |
| `eslint-plugin-react-refresh` | `^0.5.3` | Guards against Fast Refresh footguns |
| `globals` | `^17.8.0` | Browser global definitions for flat config |
| `steiger` | `^0.6.0` | FSD boundary linter, named directly in `code-standards.md` |
| `@feature-sliced/steiger-plugin` | `^0.7.0` | FSD rule set for Steiger, named directly in `code-standards.md` and Unit 3's deliverables |
| `vitest` | `^4.1.10` | Test runner, per `architecture.md`'s Stack table — installed now per your instruction, ahead of Unit 3's original deliverable list |
| `@testing-library/react` | `^16.3.2` | Renders `App` into jsdom for `App.test.tsx` |
| `jsdom` | `^30.0.1` | DOM environment for Vitest (`test.environment: 'jsdom'` in `vite.config.ts`) |

**Not installed in this unit**: `@testing-library/jest-dom` — the one
test uses plain `textContent`/`getByText` assertions, so the extra
matcher library (`toBeInTheDocument()`, etc.) has nothing to earn its
keep on yet; add it in whichever future unit's tests actually need
richer DOM matchers.

## Verification Checklist

1. `npm install` from repo root succeeds with the new
   `packages/web` workspace member present.
2. `npm run typecheck` (in `packages/web`) is clean — strict mode, no
   `any` anywhere in the four hand-written source files.
3. `npm run lint` is clean.
4. `npm run lint:boundaries` (Steiger) passes with no violations
   against the four-layer skeleton.
5. `npm run test` passes — `App.test.tsx` confirms the placeholder
   heading actually renders, not just that the build succeeds.
6. `npm run build` produces a `dist/` bundle with no errors.
7. `npm run dev` serves the app; opening it in a browser shows the
   placeholder heading with no console errors.
8. FSD layer direction holds: `main.tsx` imports only from `./app`;
   `app/index.ts` only re-exports from within `app/`; `shared/`,
   `features/`, `widgets/` import nothing (nothing to import yet) —
   no upward or sideways imports exist to check yet, but the shape is
   in place for Steiger to start catching violations from Unit 4 on.
9. No `Temporal`/`Date` code exists yet — nothing to check against
   Invariant 4 in this unit; noting it's genuinely N/A rather than
   silently skipped.
10. No runtime fetch of any kind exists in `packages/web` — Invariant 6
    trivially holds.
11. `packages/data-pipeline` and `packages/shared-types` are untouched
    by this unit (confirm via `git status`/`git diff` scoped to those
    paths).
12. `architecture.md`'s Stack table has a new row for the lint/FSD
    tooling (Implementation step 6); `code-standards.md`'s File
    Organization section needs no edit, since it already describes the
    target `packages/web/src/` structure prescriptively.
13. `progress-tracker.md` updated in this same unit (Implementation
    step 12) — phase, completed list, and the five flagged assumptions
    logged for future units to see without re-deriving them.
