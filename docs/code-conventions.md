# Code Conventions

<!-- Shared code conventions across both packages. Read before implementing shared/cross-package code. Package-specific conventions: packages/web/docs/conventions.md · packages/data-pipeline/docs/conventions.md -->

## General

- Keep modules small and single-purpose; fix root causes, don't layer workarounds.
- `packages/web` and `packages/data-pipeline` are separate workspace packages — neither imports the other; they communicate only through generated JSON and `packages/shared-types`.
- Shared devDependencies go in the root `package.json`; package-specific ones stay in that package.

## TypeScript

- Strict mode throughout; avoid `any`.
- Use `interface` for shared object contracts (`Person`, `War`, `Discovery`, all extending `TimelineEntry`), defined once in `packages/shared-types`.
- `Temporal.PlainDate` for all dates in app and pipeline code — never construct a legacy `Date` except at the one documented adapter (see `packages/web/docs/conventions.md`).

## Data and Storage

- No database, no backend. `packages/shared-types/src/data/*.json` is the only data the app reads, and it's always pipeline-generated — never hand-edited.
