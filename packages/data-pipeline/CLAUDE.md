# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot); Wars & Conflicts and Discoveries & Inventions stay Wikidata SPARQL-sourced. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Pantheon CSV + descriptions, Wikidata SPARQL → raw files): `npm run fetch --workspace packages/data-pipeline`
- Build data (raw files → pipeline-owned `data/output/`): `npm run build-data --workspace packages/data-pipeline`
- Publish data (`data/output/` → `packages/shared-types` data): `npm run publish-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`

## Code Style & Conventions

- Pipeline stages, one direction only: `fetch/` (raw results only, checked into `data/raw/` — Pantheon CSV/descriptions for People, SPARQL results for Wars/Discoveries) → `transform/` (score + tag) → `output/` (writes final JSON into the pipeline's own `data/output/`, gitignored; a separate `publish-data` script copies it into `packages/shared-types/src/data/`)
- Fetch never merges, scores, or tags — raw results only
- Fame score: sitelink count for Wars/Discoveries, Pantheon's HPI for People (Score stage) — two independent tier systems, not blended
- Occupation/region tagging is an explicit lookup table (Transform), not inferred ad hoc — lane-specific: Wikidata-QID-keyed for Wars/Discoveries, Pantheon-occupation/country-value-keyed for People
- No manual override mechanism — corrections mean fixing Score/Tag logic and re-running, not hand-editing output
- Never hand-edit `packages/shared-types/src/data/*.json` — always pipeline-generated
- `Temporal.PlainDate` is canonical everywhere (see root `CLAUDE.md` — this rule is shared with `packages/web`)

## Docs

- `docs/conventions.md` — pipeline stage rules, input validation, file organization
- `docs/architecture.md` — stack, boundaries, stage walkthrough, ADR log
- Shared conventions/architecture (apply here too): `../../docs/code-conventions.md` · `../../docs/architecture.md`
