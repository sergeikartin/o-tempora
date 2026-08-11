# packages/data-pipeline — Conventions

<!-- Pipeline code patterns. Read before implementing pipeline changes. Shared conventions: ../../../.claude/rules/code-conventions.md -->

## TypeScript

- Validate unknown external input (raw Wikidata results, Pantheon CSV) at system boundaries, before Transform touches it.

## Data Pipeline

- Prefer hand-rolled parsers for narrow, well-understood formats (`src/fetch/csv.ts`); add a real dependency only when the format is genuinely non-trivial (e.g. `seek-bzip` for bzip2), and record it in `CLAUDE.md`'s Stack table.

## File Organization

`src/fetch/` (query/CSV-row builders, raw-result writers), `src/transform/` (grouping, scoring, tagging, lookup tables), `src/output/` (final JSON writer), `data/raw/` (checked-in raw snapshots).
