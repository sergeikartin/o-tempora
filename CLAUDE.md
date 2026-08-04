# CLAUDE.md

<!-- Keep this file short. It's the index — detail lives in docs/. -->

## Project Overview

- Project Name: World History Timeline (npm package: `same-sky`)
- Read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded ahead of time (People from Pantheon 2.0, Wars & Conflicts/Events & Inventions from Wikidata). No accounts, no editing, no live data fetching.
- Stack: React 19 + TypeScript + Vite + vis-timeline (frontend); Node.js + TypeScript (data pipeline); npm workspaces monorepo — `packages/web`, `packages/data-pipeline`, `packages/shared-types`.

## Setup & Build

- Install (from repo root — single lockfile, don't `npm install` inside a package): `npm install`
- Everything else is workspace-scoped: `packages/web/CLAUDE.md` (dev/build/lint/test) · `packages/data-pipeline/CLAUDE.md` (fetch/build-data/test)

## Rules that apply everywhere

- `Temporal.PlainDate` is the canonical date type everywhere except the one legacy-`Date` adapter (`toLegacyDate()` in `packages/web`'s `shared/lib/dates.ts`, called only from `widgets/timeline-canvas/`)
- Never hand-edit `packages/shared-types/src/data/*.json` or `packages/data-pipeline/data/raw/` — both are pipeline-generated; fix the pipeline stage and regenerate
- Filters always combine with AND, never OR
- No runtime Wikidata/API calls, no database, no persistence — the app only ever reads bundled static JSON
- One unit of work per turn; stop for review before starting the next — don't build ahead unasked
- Work spec-first: read `docs/workflow.md` before starting, and the relevant `docs/*.md` before writing code

## Documentation Map

Read on demand — only load what the current task needs.

| Doc | Read when |
|---|---|
| [docs/product-scope.md](docs/product-scope.md) | Making a scope or UX call |
| [docs/architecture.md](docs/architecture.md) | Touching architecture, storage, or a package boundary |
| [docs/code-conventions.md](docs/code-conventions.md) | Writing shared/cross-package code |
| [docs/workflow.md](docs/workflow.md) | Before starting any unit of work |
| [docs/active-context.md](docs/active-context.md) | Session start — current phase, open questions |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Debugging a recurring issue |
| [docs/config-variables.md](docs/config-variables.md) | Touching config |
| `packages/web/CLAUDE.md` + `packages/web/docs/` | Working in `packages/web` |
| `packages/data-pipeline/CLAUDE.md` + `packages/data-pipeline/docs/` | Working in `packages/data-pipeline` |
| `context/specs/*.md` | Picking up a specific, already-planned unit of work |

**Doc upkeep:** if a task changes scope, architecture, or conventions, update the relevant `docs/*.md` in the same unit of work — don't leave docs stale. See `docs/workflow.md` for the full delivery process.

**Machine-local auto-memory** (`~/.claude/.../memory/`) is a personal pointer into this doc set, not a duplicate — it isn't git-tracked, doesn't survive a clone, and is never authoritative over `docs/*.md`.

For libraries/frameworks, verify current APIs before implementing.
