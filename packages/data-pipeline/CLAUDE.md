# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot); Wars & Conflicts (`data/raw/wars-curated.raw.json`) and Discoveries & Inventions (`data/raw/events-curated.raw.json`) are both hand-curated lists backfilled with a batched per-QID Wikidata SPARQL enrichment pass, not a corpus scan. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Pantheon CSV + taglines, Wikidata SPARQL enrichment, Wikipedia extracts → raw files): `npm run fetch --workspace packages/data-pipeline`
- Build data (raw files → pipeline-owned `data/output/`): `npm run build-data --workspace packages/data-pipeline`
- Publish data (`data/output/` → `packages/shared-types` data): `npm run publish-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`


## Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) — Wars' and Discoveries' per-QID enrichment (including `tagline`, live-fetched for all three lanes), People's secondary reign/tagline enrichment |
| Article prose | Wikipedia REST summary API (`wikipedia-client.ts`) — lead-paragraph `extract` for the optional `description` field, People/Wars/Discoveries alike; a distinct API from Wikidata SPARQL, paced separately (~2/sec, no VALUES-clause batching available) — see `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` |
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

1. **Fetch** — People: Pantheon CSV plus two batched SPARQL enrichment passes keyed on Wikidata QID (`tagline` + P18 image, reign/term-of-office periods). Wars and Discoveries: each a checked-in hand-curated list, backfilled with its own batched per-QID SPARQL enrichment pass (sitelinks, Wikipedia URL, country, P18 image, `tagline` — live-fetched for both lanes now, no curated fallback — plus start/end dates for Wars specifically; Discoveries' `year` remains curator-authored) — not a corpus scan. A further batched Commons `imageinfo` pass (`fetch-image-attribution.ts`) resolves `imageAttribution` for every People/Wars/Discoveries entity that got an image, keyed by the same ids. A separate, sequentially-paced Wikipedia REST pass (`fetch-wikipedia-extracts.ts`) resolves an optional `description` (lead-paragraph prose, independent of `tagline`) for every People/Wars/Discoveries entity with a resolvable English Wikipedia article — this pipeline's second live external dependency, alongside Wikidata SPARQL. All raw output checked into `data/raw/`.
2. **Score** — Wars and Discoveries: rank by sitelink count, no floor (already hand-vetted curated lists). People: Pantheon's HPI. Two independent tier systems, never blended.
3. **Tag** — Wars: curator-assigned `ConflictCategory` passes straight through; region tags keyed off Wikidata country Q-IDs from enrichment. Discoveries: curator-assigned `DiscoveryCategory` passes straight through; region tags the same way. People: Pantheon's own occupation/country string values onto `OccupationDomain`/`UnRegion`, a fully enumerated closed set.
4. **Output** — final JSON written to pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types`, keeping "compute" and "publish" as separate steps.

No manual override/correction mechanism — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

## Docs

- `docs/code-conventions.md` — pipeline-specific code patterns, file organization
- `docs/adr/` — architecture decision records
- Shared conventions (apply here too): `../../docs/code-conventions.md`
