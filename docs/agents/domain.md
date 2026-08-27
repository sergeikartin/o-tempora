# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the whole repo's domain glossary and decisions.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check `packages/<package>/docs/adr/` for package-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

One shared glossary, package-scoped decision logs:

```
/
├── CONTEXT.md                          ← domain glossary + decisions, whole repo
├── docs/adr/                           ← system-wide decisions
└── packages/
    ├── web/docs/adr/                   ← package-specific decisions
    ├── data-pipeline/docs/adr/
    └── shared-types/                   (no package-scoped ADRs yet)
```

`CONTEXT.md` (domain glossary + decisions) is distinct from each package's `CLAUDE.md` (agent operating instructions) — they coexist.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant package's `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
