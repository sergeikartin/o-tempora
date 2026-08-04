# Workflow

<!-- Repo-specific process rules for how work gets done here. Read before starting a unit of work. -->

## Investigation

- Never speculate about code you haven't read — read files and `rg` for usages before making claims.
- If the user references a file, read it before answering.
- If uncertain, say so and propose how to verify; don't fabricate APIs, paths, or behavior.
- When intent is ambiguous, default to research and recommendations — only edit when explicitly asked.
- Follow scoping words ("only", "just", "exactly") literally.

## Tools

- Use `rg` not grep, `fd` not find — `tree` is not installed.

## Delivery process

(these are rules, not suggestions — if a rule and a request conflict, stop and flag it rather than silently picking one)

- Work spec-first: read `docs/architecture.md` and `docs/code-conventions.md` (plus the package-level equivalents) in full before writing code for a unit of work; state in 1-2 sentences what you're building and which invariant(s) apply.
- One unit of work per turn (one feature slice, one widget, one pipeline stage, or one bug fix); stop for review before starting the next — don't build ahead unasked.
- No speculative changes: don't refactor unrelated code, rename files, cross mini-FSD layer boundaries, reintroduce a dropped layer (`entities`/`pages`), or touch `packages/data-pipeline` while working on `packages/web` (or vice versa) unless the task explicitly spans both.
- Don't add a dependency not already listed in `docs/architecture.md`'s Stack table without flagging it first.
- If a task spans more than one FSD layer, split it one layer per step in dependency order (`shared → features → widgets → app`); if a task spans both frontend and pipeline, split it into two units even if related.
- If a requirement is missing, ambiguous, or conflicts with `docs/architecture.md`/`docs/code-conventions.md`, stop and ask — never invent scope or silently violate an invariant.
- Never hand-edit `packages/shared-types/src/data/*.json` or `packages/data-pipeline/data/raw/` — both are pipeline-generated; fix the pipeline stage and regenerate.
- If implementation reveals a documented decision is wrong or a new invariant emerges, update the relevant `docs/*.md` in the same unit of work — don't leave docs stale.

## Definition of done

- FSD layer direction respected
- `Temporal.PlainDate` used everywhere but the one adapter
- Filters combine with AND, never OR
- No runtime Wikidata/API calls
- Steiger passes, TypeScript strict is clean
- Tests and lint pass

## Documentation upkeep

After significant work, update `docs/active-context.md` (progress, open questions) and the relevant `docs/*.md` if scope, architecture, or conventions changed. Machine-local auto-memory is a personal pointer into this doc set, not a duplicate of it — it's not authoritative and doesn't need mirroring.
