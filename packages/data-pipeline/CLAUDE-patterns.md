# packages/data-pipeline — Patterns

<!-- Pipeline code patterns. Read before implementing pipeline changes. Shared conventions: ../../CLAUDE-patterns.md -->

### TypeScript

- Validate unknown external input at system boundaries (e.g. raw Wikidata query results, before Transform touches them).

### Data Pipeline

- Fetch never merges, scores, or tags — only writes raw results.
- Fame score is sitelink count only (Score stage).
- Occupation/region tagging is an explicit lookup table (Transform), not inferred ad hoc.
- No manual override mechanism — corrections mean fixing Score/Tag logic and re-running.

### File Organization

`packages/data-pipeline/`: `fetch/` (SPARQL queries and raw-result writers), `transform/` (grouping, scoring, tagging, including the occupation/region/event-type lookup tables), `output/` (final JSON writer), `data/raw/` (checked-in raw snapshots).
