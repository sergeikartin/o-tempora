# Architecture

<!-- Architecture decisions and invariants. Read before touching architecture, storage, or crossing a package boundary. -->

Two independently-shippable parts: **`packages/web`** (frontend — React + TypeScript + Vite + vis-timeline, mini-FSD) and **`packages/data-pipeline`** (offline Node/TypeScript pipeline that curates the frontend's dataset from Wikidata/Pantheon). The pipeline runs offline to produce static JSON; the frontend only ever reads that JSON. Both are npm-workspace packages, alongside **`packages/shared-types`** (shared `Person`/`War`/`Discovery`/`Category`/`Region` types, all three extending a common `TimelineEntry` shape, plus the generated `people.json`/`wars.json`/`discoveries.json`), which lets `web` and `data-pipeline` share types and data without importing each other directly.

Package-specific stack, boundaries, and pipeline stages: `packages/web/docs/architecture.md` · `packages/data-pipeline/docs/architecture.md`

## Stack

| Layer | Technology |
|---|---|
| Date handling | `Temporal` (via `temporal-polyfill`), native BCE support |
| Data format | Static JSON, bundled at build time |
| Hosting | Static hosting (no server process) |
| Monorepo tooling | npm workspaces (`packages/*`) |

No backend service, no database — the shipped product is a static bundle plus static data files.

## System Boundaries

- `packages/web` and `packages/data-pipeline` never import each other directly; both import from `packages/shared-types` (types at compile time, generated JSON at build time).

## Storage Model

No database anywhere. Frontend: bundled JSON plus in-memory state only (filters, viewport — nothing persisted). Pipeline: checked-in JSON files as intermediate storage. Datasets are pipeline-generated, never hand-edited.

## Auth and Access Model

No authentication in v1 — no login, no accounts, no ownership model. Every visitor sees the same dataset with the same capabilities.

## Invariants

Rules the codebase must never violate:

1. **The app never writes anywhere at runtime** — no dataset mutation, no database, no localStorage. Read-only is a product decision; introducing persistence is a scope change, not a bug fix.
2. **Filters always combine with AND, never OR** — fame tier AND occupation AND region, simultaneously.
3. **Fame tiers are strictly nested** — a higher tier is always a superset of a lower one; no re-ranking when the tier changes.
4. **`Temporal.PlainDate` is the only date type** in app/pipeline code; the sole exception is `toLegacyDate()` in `shared/lib/dates.ts`, called only from `widgets/timeline-canvas/`.
5. **Viewport is bounded to a 10-250 year window** — never narrower or wider.
6. **No runtime code fetches from Wikidata or any external API** — all data enters via the offline pipeline only.
7. **`packages/shared-types/src/data/*.json` is always machine-generated, never hand-edited.**
8. **The pipeline's Fetch stage never merges, scores, or tags data** — raw results only.

## Architecture Decisions Log

Durable, still-relevant decisions from implementation. Day-to-day history lives in `docs/active-context.md` and git history, not here.

- `packages/shared-types` exists specifically so types and generated datasets can be shared between `packages/web` and `packages/data-pipeline` without either importing the other.

Package-specific decisions: `packages/web/docs/architecture.md` · `packages/data-pipeline/docs/architecture.md`
