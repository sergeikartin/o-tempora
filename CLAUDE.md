# CLAUDE.md

<!-- Keep this file short. It's the index — detail lives in docs/. -->

## Project Overview
Read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded ahead of time. No accounts, no editing, no live data fetching.

## Documentation Map

Read on demand — only load what the current task needs.

| Doc | Read when |
|---|---|
| [docs/product-scope.md](docs/product-scope.md) | Making a scope or UX call |
| [docs/code-conventions.md](docs/code-conventions.md) | Writing shared/cross-package code |
| [docs/workflow.md](docs/workflow.md) | Before starting any unit of work |
| [docs/active-context.md](docs/active-context.md) | Session start — current phase, open questions |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Debugging a recurring issue |
| [docs/config-variables.md](docs/config-variables.md) | Touching config |
| `packages/web/CLAUDE.md` + `packages/web/docs/` | Working in `packages/web` |
| `packages/data-pipeline/CLAUDE.md` + `packages/data-pipeline/docs/` | Working in `packages/data-pipeline` |

**Doc upkeep:** if a task changes scope, architecture, or conventions, update the relevant `docs/*.md` in the same unit of work — don't leave docs stale. See `docs/workflow.md` for the full delivery process.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context — root `CONTEXT-MAP.md` points to a `CONTEXT.md` per package under `packages/*/`. See `docs/agents/domain.md`.
