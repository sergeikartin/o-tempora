# AGENTS.md

<!-- Keep this file short. It's the index — detail lives in docs/. -->
Provide concise, focused responses. Skip non-essential context, and keep examples minimal.

## Project Overview
Read-only interactive timeline of world history with People, Conflicts, and Milestones lanes built from a static dataset.

## Packages

Data flows from `data-pipeline` through `shared-types` to `web`.

| Package | Role |
|---|---|
| `packages/data-pipeline` | Offline Node pipeline; the only place data is fetched/generated |
| `packages/shared-types` | The published dataset (JSON) plus the TypeScript types/constants both other packages read |
| `packages/web` | React/D3 frontend that renders the published dataset |

Read the package’s `AGENTS.md` before working there. Edit `AGENTS.md` as the source for its `CLAUDE.md` import.

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
| [Issue tracker](docs/agents/issue-tracker.md) and [triage labels](docs/agents/triage-labels.md) | Picking up, finishing, filing or triaging a ticket under `.scratch/` |
| [packages/web/DESIGN.md](packages/web/DESIGN.md), [packages/web/PRODUCT.md](packages/web/PRODUCT.md) | Changing how the UI looks or lays out (DESIGN), or its audience and positioning (PRODUCT) |
| [GLOSSARY.md](GLOSSARY.md) | Before exploring the codebase, or naming a domain concept — see `docs/agents/domain.md` for how to consume it |

## Doc upkeep

- Update affected living docs in the same change as current behavior. Describe the current system and keep change history in ADRs and Git. Split docs by task when they outgrow a screen.
- Record architecture decisions in root or package ADRs in the same change. When replacing one, append a new ADR with `supersedes`. Add `status: superseded` and `superseded-by` to the old ADR’s frontmatter and preserve its text.
