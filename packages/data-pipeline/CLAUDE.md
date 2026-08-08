# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot); Wars & Conflicts stays a Wikidata SPARQL candidate scan; Discoveries & Inventions is a hand-curated list (`data/raw/events-curated.raw.json`) backfilled with a batched per-QID Wikidata SPARQL enrichment pass, not a corpus scan. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

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
| Pipeline query layer | Wikidata Query Service (SPARQL) — Wars' candidate source, Discoveries' per-QID enrichment, People's secondary reign/description enrichment |
| Image attribution | Wikimedia Commons `imageinfo` REST API (`commons-client.ts`) — per-file license/credit lookup for People/Discoveries' P18 images, a distinct MediaWiki API from Wikidata SPARQL |
| People-lane data source | Pantheon 2.0 (downloaded CSV snapshot) |
| bzip2 decompression | `seek-bzip` (pure-JS) — Pantheon's dataset ships `.bz2`, no Node/system support |
| Pipeline scripting | Node.js + TypeScript |
| Intermediate storage | Local JSON/CSV files, checked into the repo |
| Testing | `node:test` |

## System Boundaries

Pipeline stages, one direction only: `src/fetch/` (raw results only) → `src/transform/` (score + tag) → `src/output/` (writes into pipeline-owned `data/output/`, then `publish-data` copies it into `packages/shared-types/src/data/`).

## Data Pipeline

Runs on-demand only — no scheduler, no live connection once data is generated.

1. **Fetch** — People: Pantheon CSV plus two batched SPARQL enrichment passes keyed on Wikidata QID (descriptions + P18 image, reign/term-of-office periods). Wars: 9 independent per-`ConflictCategory` SPARQL queries (one Wikidata `?type` class each, one raw file each), each backfilling P18 image the same way. Discoveries: the checked-in hand-curated list, backfilled with a batched per-QID SPARQL enrichment pass (sitelinks, Wikipedia URL, country, P18 image) — not a corpus scan. A further batched Commons `imageinfo` pass (`fetch-image-attribution.ts`) resolves `imageAttribution` for every People/Wars/Discoveries entity that got an image, keyed by the same ids. All raw output checked into `data/raw/`.
2. **Score** — Wars: per-category sitelink-count floor (flat 70/90/100 across all 9 categories today) + rank; an entity clearing more than one category's fetch query (a Wikidata item with multiple `instance of` claims) is deduped to its first-matching category before scoring. Discoveries: rank by sitelink count, no floor (already hand-vetted). People: Pantheon's HPI. Three independent tier systems, never blended.
3. **Tag** — Wars: direct 1:1 Wikidata Q-ID → `ConflictCategory` map (no collapsing), plus a region lookup off Wikidata country Q-IDs. Discoveries: curator-assigned `DiscoveryCategory` passes straight through; region tags still keyed off Wikidata country Q-IDs from enrichment. People: Pantheon's own occupation/country string values onto `OccupationDomain`/`UnRegion`, a fully enumerated closed set.
4. **Output** — final JSON written to pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types`, keeping "compute" and "publish" as separate steps.

No manual override/correction mechanism — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

## Docs

- `docs/code-conventions.md` — pipeline-specific code patterns, file organization
- `docs/adr/` — architecture decision records
- Shared conventions (apply here too): `../../docs/code-conventions.md`
