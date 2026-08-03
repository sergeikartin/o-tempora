# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets from Wikidata SPARQL. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Wikidata → raw JSON): `npm run fetch --workspace packages/data-pipeline`
- Build data (→ `shared-types` data): `npm run build-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`

## Code Style & Conventions

- Pipeline stages, one direction only: `fetch/` (raw SPARQL results only, checked into `data/raw/`) → `transform/` (score + tag) → `output/` (writes final JSON into `packages/shared-types/src/data/`)
- Fetch never merges, scores, or tags — raw results only
- Fame score is sitelink count only (Score stage); no other signal blended in
- Occupation/region tagging is an explicit lookup table (Transform), not inferred ad hoc
- No manual override mechanism — corrections mean fixing Score/Tag logic and re-running, not hand-editing output
- Never hand-edit `packages/shared-types/src/data/*.json` — always pipeline-generated
- `Temporal.PlainDate` is canonical everywhere (see root `CLAUDE.md` — this rule is shared with `packages/web`)
- Full rules: `CLAUDE-patterns.md` (shared conventions: `../../CLAUDE-patterns.md`)
- Package architecture decisions: `CLAUDE-decisions.md` (product scope and invariants: `../../CLAUDE-decisions.md`)
