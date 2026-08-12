# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot); Conflicts (`data/raw/conflicts-curated.raw.json`) and Milestones (`data/raw/milestones-curated.raw.json`) are both hand-curated lists backfilled with a batched per-QID Wikidata SPARQL enrichment pass, not a corpus scan. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Pantheon CSV + taglines, Wikidata SPARQL enrichment, Wikipedia extracts → raw files): `npm run fetch --workspace packages/data-pipeline`. Add `-- --lane=<people|conflicts|milestones>` to scope a run to one lane (e.g. re-fetching Milestones after a curated-list edit) instead of the ~35 min full run; omitted, runs all three lanes as before. Don't run two lane-scoped fetches at once (two terminals) — `fetchWikipediaExtracts`'s shared ~2 req/sec pace across lanes assumes only one lane hits Wikipedia at a time (docs/adr/0012-lane-scoped-fetch.md).
- Build data (raw files → pipeline-owned `data/output/`): `npm run build-data --workspace packages/data-pipeline`
- Publish data (`data/output/` → `packages/shared-types` data): `npm run publish-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`


## Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) — Conflicts' and Milestones' per-QID enrichment (including `tagline`, live-fetched for all three lanes), People's secondary tagline enrichment |
| Article prose | Wikipedia REST summary API (`wikipedia-client.ts`) — lead-paragraph `extract` for the optional `description` field, People/Conflicts/Milestones alike; a distinct API from Wikidata SPARQL, paced separately (~2/sec, no VALUES-clause batching available) — see `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` |
| Image attribution | Wikimedia Commons `imageinfo` REST API (`commons-client.ts`) — per-file license/credit lookup for People/Milestones' P18 images, a distinct MediaWiki API from Wikidata SPARQL |
| People-lane data source | Pantheon 2.0 (downloaded CSV snapshot) |
| bzip2 decompression | `seek-bzip` (pure-JS) — Pantheon's dataset ships `.bz2`, no Node/system support |
| Pipeline scripting | Node.js + TypeScript |
| Intermediate storage | Local JSON/CSV files, checked into the repo |
| Testing | `node:test` |

## System Boundaries

Pipeline stages, one direction only: `src/fetch/` (raw results only) → `src/transform/` (score + tag) → `src/output/` (writes into pipeline-owned `data/output/`, then `publish-data` copies it into `packages/shared-types/src/data/`).

## Data Pipeline

Runs on-demand only — no scheduler, no live connection once data is generated.

1. **Fetch** — People: Pantheon CSV plus a batched SPARQL enrichment pass keyed on Wikidata QID (`tagline` + P18 image). Conflicts and Milestones: each a checked-in hand-curated list, backfilled with its own batched per-QID SPARQL enrichment pass (sitelinks, Wikipedia URL, country, P18 image, `tagline`, and dates — live-fetched for both lanes now, no curated fallback; Conflicts resolves a start/end range off P580/P585/P582, Milestones resolves a single year/month off a 10-property priority-ordered COALESCE since no one property reliably holds "the" date across its wider spread of entity shapes — see `docs/adr/0015-milestones-taxonomy-expansion-and-date-fetching.md`) — not a corpus scan. A further batched Commons `imageinfo` pass (`fetch-image-attribution.ts`) resolves `imageAttribution` for every People/Conflicts/Milestones entity that got an image, keyed by the same ids. A separate, sequentially-paced Wikipedia REST pass (`fetch-wikipedia-extracts.ts`) resolves an optional `description` (lead-paragraph prose, independent of `tagline`) for every People/Conflicts/Milestones entity with a resolvable English Wikipedia article — this pipeline's second live external dependency, alongside Wikidata SPARQL. These three passes each write one raw file per lane (`<lane>-image-attribution.raw.json`, `<lane>-pageviews.raw.json`, `<lane>-wikipedia-extracts.raw.json`), not one combined file, so `--lane` can scope a run to just the lane that changed (docs/adr/0012-lane-scoped-fetch.md). All raw output checked into `data/raw/`.
2. **Score** — Conflicts and Milestones: rank by sitelink count, no floor (already hand-vetted curated lists). People: Pantheon's HPI. Two independent tier systems, never blended.
3. **Tag** — Conflicts: curator-assigned `ConflictCategory` passes straight through; region tags keyed off Wikidata country Q-IDs from enrichment. Milestones: curator-assigned `MilestoneCategory` passes straight through; region tags the same way. People: Pantheon's own occupation/country string values onto `OccupationDomain`/`UnRegion`, a fully enumerated closed set.
4. **Output** — final JSON written to pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types`, keeping "compute" and "publish" as separate steps.

No manual override/correction mechanism — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

## Docs

- `docs/code-conventions.md` — pipeline-specific code patterns, file organization
- `docs/adr/` — architecture decision records
