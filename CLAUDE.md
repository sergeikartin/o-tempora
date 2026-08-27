# CLAUDE.md

<!-- Keep this file short. It's the index — detail lives in docs/. -->
Provide concise, focused responses. Skip non-essential context, and keep examples minimal.

## Project Overview
Read-only, continuously zoomable visualization of world history — People, Conflicts, and Milestones lanes, hardcoded ahead of time. No accounts, no editing, no live data fetching.

## Packages

Three-package monorepo, data flowing one direction only: `data-pipeline` fetches/curates → writes JSON into `shared-types` → `web` reads it and renders. Never the reverse — `web` never fetches or writes data, `shared-types` never fetches.

| Package | Role |
|---|---|
| `packages/data-pipeline` | Offline Node pipeline; the only place data is fetched/generated |
| `packages/shared-types` | The published dataset (JSON) plus the TypeScript types/constants both other packages read |
| `packages/web` | React/D3 frontend; reads `shared-types`, renders the timeline, no live fetching |

Each has its own `CLAUDE.md` (and `packages/{web,data-pipeline}/docs/adr/`) for package-scoped detail.

## Documentation Map

Read on demand — only load what the current task needs.

| Doc | Read when |
|---|---|
| [docs/product-scope.md](docs/product-scope.md) | Making a scope or UX call |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Debugging a recurring issue |
| [docs/config-variables.md](docs/config-variables.md) | Touching config |
| [docs/observability.md](docs/observability.md) | Adding or changing tracked errors/events |
| [docs/deployment.md](docs/deployment.md) | Touching build/deploy config |
| [docs/adr/](docs/adr/) | Making a system-wide architectural call, or recording one — also check `packages/<package>/docs/adr/` for package-scoped decisions |
| [CONTEXT.md](CONTEXT.md) | Before exploring the codebase, or naming a domain concept — see `docs/agents/domain.md` for how to consume it |

**Two-tier docs.** `docs/*.md` (and each package's `docs/*.md` other than `docs/adr/`) are **living docs**: they describe how the system works *right now*, edited in place as it changes, with no history and no "why we chose X over Y" — that reasoning belongs in an ADR. `docs/adr/` (root and per-package) is an **append-only log**: each ADR is a decision captured at a point in time — problem, decision, rationale — and once written is never edited to match new reality. When a decision changes, write a new ADR that supersedes the old one; mark the old one's frontmatter `status: superseded` / `superseded-by: <file>`, and the new one's `supersedes: <file>`, rather than rewriting its content.

**Doc upkeep:** if a task changes current behavior, update the relevant living doc in the same unit of work — don't leave docs stale. If a task makes or reverses an architectural decision, write the ADR in the same unit of work. Avoid adding edit history, changelogs, diff descriptions, or ticket numbers to living docs — keep them high-level and current-state-only.

Keep docs/*.md focused — split a doc when it stops fitting one screen rather than letting it grow unbounded.

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

