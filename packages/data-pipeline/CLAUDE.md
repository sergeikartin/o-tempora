# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot); Wars & Conflicts and Discoveries & Inventions stay Wikidata SPARQL-sourced. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Pantheon CSV + descriptions, Wikidata SPARQL → raw files): `npm run fetch --workspace packages/data-pipeline`
- Build data (raw files → pipeline-owned `data/output/`): `npm run build-data --workspace packages/data-pipeline`
- Publish data (`data/output/` → `packages/shared-types` data): `npm run publish-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`


## Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) — Wars/Discoveries source, People's secondary reign/description enrichment |
| People-lane data source | Pantheon 2.0 (downloaded CSV snapshot) |
| bzip2 decompression | `seek-bzip` (pure-JS) — Pantheon's dataset ships `.bz2`, no Node/system support |
| Pipeline scripting | Node.js + TypeScript |
| Intermediate storage | Local JSON/CSV files, checked into the repo |
| Testing | `node:test` |

## System Boundaries

Pipeline stages, one direction only: `fetch/` (raw results only) → `transform/` (score + tag) → `output/` (writes into pipeline-owned `data/output/`, then `publish-data` copies it into `packages/shared-types/src/data/`).

## Data Pipeline

Runs on-demand only — no scheduler, no live connection once data is generated.

1. **Fetch** — People: Pantheon CSV plus a batched SPARQL description-enrichment pass keyed on Wikidata QID. Wars/Discoveries: SPARQL pulls candidate events; a reign/term-of-office enrichment query exists but is unwired. All raw output checked into `data/raw/`.
2. **Score** — Wars/Discoveries: sitelink count. People: Pantheon's HPI. Two independent tier systems, never blended.
3. **Tag** — Wars/Discoveries: Wikidata Q-ID-keyed lookup table onto fixed event-type/region categories. People: Pantheon's own occupation/country string values onto `OccupationDomain`/`UnRegion`, a fully enumerated closed set.
4. **Output** — final JSON written to pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types`, keeping "compute" and "publish" as separate steps.

No manual override/correction mechanism — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

## Docs

- `docs/code-conventions.md` — pipeline-specific code patterns, file organization
- `docs/adr/` — architecture decision records
- Shared conventions (apply here too): `../../docs/code-conventions.md`
