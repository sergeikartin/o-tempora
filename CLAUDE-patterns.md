# Patterns

<!-- Code and design patterns/conventions. Read before implementing features or touching styling. -->

## Code Standards

### General

- Keep modules small and single-purpose; fix root causes, don't layer workarounds.
- `packages/web` and `packages/data-pipeline` are separate workspace packages — neither imports the other; they communicate only through generated JSON and `packages/shared-types`.
- Shared devDependencies go in the root `package.json`; package-specific ones stay in that package.

### TypeScript

- Strict mode throughout; avoid `any`.
- Use `interface` for shared object contracts (`Person`, `HistoricalEvent`), defined once in `packages/shared-types`.
- `Temporal.PlainDate` for all dates in app and pipeline code — never construct a legacy `Date` except at the one documented adapter (see `packages/web/CLAUDE-patterns.md`).

### Data and Storage

- No database, no backend. `packages/shared-types/src/data/*.json` is the only data the app reads, and it's always pipeline-generated — never hand-edited.

---

Package-specific patterns: `packages/web/CLAUDE-patterns.md` (FSD/Steiger boundaries, React, styling, vis-timeline, UI tokens) · `packages/data-pipeline/CLAUDE-patterns.md` (input validation, pipeline stages, file organization).
