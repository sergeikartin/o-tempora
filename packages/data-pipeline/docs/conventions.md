# packages/data-pipeline — Conventions

<!-- Pipeline code patterns. Read before implementing pipeline changes. Shared conventions: ../../../docs/code-conventions.md -->

## TypeScript

- Validate unknown external input at system boundaries (e.g. raw Wikidata query results or the Pantheon CSV, before Transform touches them).

## Data Pipeline

- Fetch never merges, scores, or tags — only writes raw results.
- Fame score: sitelink count for Wars & Conflicts / Discoveries & Inventions (`FAME_TIER_MIN_SITELINKS`), Pantheon's HPI for People (`FAME_TIER_MIN_HPI`) — independent tier systems (Score stage), not blended.
- Occupation/region tagging is an explicit lookup table (Transform), not inferred ad hoc — lane-specific, not pipeline-wide: Wars/Discoveries stay keyed on Wikidata Q-IDs (`region-categories.ts`, `event-type-categories.ts`); People is keyed on Pantheon's own occupation/country string values (`occupation-domain-categories.ts`, `un-region-categories.ts`), a closed, fully-enumerated set with no unmapped-value backlog.
- No manual override mechanism — corrections mean fixing Score/Tag logic and re-running.
- Hand-rolled parsers (`fetch/csv.ts`) are preferred over adding a dependency for narrow, well-understood formats; a real dependency (e.g. `seek-bzip` for bzip2 decompression, which Node has no built-in support for) is added only when the format/algorithm is genuinely non-trivial to reimplement correctly — flagged in `docs/architecture.md`'s Stack table either way.

## File Organization

`packages/data-pipeline/`: `fetch/` (query/CSV-row builders and raw-result writers — `queries/` for Wikidata SPARQL, `pantheon-row-shape.ts`/`csv.ts` for Pantheon), `transform/` (grouping, scoring, tagging, including the occupation/region/event-type lookup tables), `output/` (final JSON writer), `data/raw/` (checked-in raw snapshots).
