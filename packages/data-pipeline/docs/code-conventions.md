# packages/data-pipeline — Conventions

<!-- Pipeline code patterns. Read before implementing pipeline changes. Shared conventions: ../../../.claude/rules/code-conventions.md -->

## TypeScript

- Run `.ts` entry points and tests directly with Node (`>=26.0.0`) using native type stripping: use explicit `.ts` extensions on relative imports and keep syntax erasable (`erasableSyntaxOnly` in `tsconfig.json`).
- Validate unknown external input (raw Wikidata results, Pantheon CSV, Profile subagent JSON handoffs) at system boundaries, before Transform or downstream steps touch it.

## Data Pipeline

- Prefer hand-rolled parsers for narrow, well-understood formats (`src/fetch/csv.ts`); add a real dependency only when the format is genuinely non-trivial (e.g. `seek-bzip` for bzip2, `zod` for typed Profile handoff schemas, `node-html-markdown` for HTML-to-Markdown source caching), and document the dependency where its use matters.

## File Organization

`src/fetch/` (query/CSV-row builders, raw-result writers), `src/transform/` (grouping, scoring, tagging, lookup tables), `src/output/` (final JSON writer), `src/profiles/` (the Profile CLI and workflow, outside the stage order), `data/raw/` (checked-in raw snapshots), `.work/` (gitignored transient Profile drafts, verdicts, and fetched source cache).
