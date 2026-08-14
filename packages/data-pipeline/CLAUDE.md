# packages/data-pipeline

Offline Node.js + TypeScript pipeline that curates `packages/shared-types` datasets, in English and Russian. People is sourced from Pantheon 2.0 (a downloaded CSV snapshot) for everything except `name`/`tagline`; Conflicts (`data/raw/conflicts-curated.raw.json`) and Milestones (`data/raw/milestones-curated.raw.json`) are both hand-curated lists (`category`/`parentId` only) backfilled with a batched per-QID Wikidata SPARQL enrichment pass, not a corpus scan. Every lane's `name`/`tagline` is sourced symmetrically from Wikidata's own `rdfs:label`/`schema:description`, fetched in both `en` and `ru` (`docs/adr/0017-name-sourced-from-wikidata-label-plus-russian-wikipedia-dependency.md`); `description` is a second, per-language live Wikipedia REST pass (`en.wikipedia.org`/`ru.wikipedia.org`). Output writes two fully parallel dataset files per lane (e.g. `people.json`/`people.ru.json`) with per-field English fallback already baked into the Russian file — see `CONTEXT.md`'s **Field Fallback**. Runs on-demand only — never at app runtime, no scheduler, no live connection once data is generated.

## Build, Test & Verify

Run from repo root:

- Fetch (Pantheon CSV + taglines, Wikidata SPARQL enrichment, Wikipedia extracts → raw files): `npm run fetch --workspace packages/data-pipeline`. Add `-- --lane=<people|conflicts|milestones>` to scope a run to one lane (e.g. re-fetching Milestones after a curated-list edit) instead of the full run (previously ~35 min observed pre-Russian-extract-pass, `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` — now roughly double that, since `fetchWikipediaExtracts` runs a second, sequential `ru.wikipedia.org` pass alongside the English one); omitted, runs all three lanes as before. Don't run two lane-scoped fetches at once (two terminals) — `fetchWikipediaExtracts`'s shared ~2 req/sec pace across lanes assumes only one lane hits Wikipedia at a time (docs/adr/0012-lane-scoped-fetch.md).
- Build data (raw files → pipeline-owned `data/output/`): `npm run build-data --workspace packages/data-pipeline`
- Publish data (`data/output/` → `packages/shared-types` data): `npm run publish-data --workspace packages/data-pipeline`
- Test: `npm run test --workspace packages/data-pipeline` (`node:test`)
- Type check: `npm run typecheck --workspace packages/data-pipeline`


## Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) — Conflicts' and Milestones' per-QID enrichment (including `name`/`tagline`, each live-fetched in English and Russian for all three lanes — `docs/adr/0017-name-sourced-from-wikidata-label-plus-russian-wikipedia-dependency.md`), People's secondary name/tagline enrichment |
| Article prose | Wikipedia REST summary API (`wikipedia-client.ts`) — lead-paragraph `extract` for the optional `description` field, People/Conflicts/Milestones alike, fetched separately against `en.wikipedia.org` and `ru.wikipedia.org` (`lang` parameter, `docs/adr/0017-...`); a distinct API from Wikidata SPARQL, paced separately per language (~2/sec, no VALUES-clause batching available) — see `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` |
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

1. **Fetch** — People: Pantheon CSV plus a batched SPARQL enrichment pass keyed on Wikidata QID (`name`/`tagline`, each in `en`+`ru`, + P18 image + a Russian Wikipedia article title for the Russian `description` pass below — `queries/taglines.ts`); Pantheon's own CSV `name` column is read but no longer used. Conflicts and Milestones: each a checked-in hand-curated list (`category`/`parentId` only — Conflicts' and Milestones' curated `name` is read but no longer used), backfilled with its own batched per-QID SPARQL enrichment pass (sitelinks, Wikipedia URL per pageviews-basket language, country, P18 image, `name`/`tagline` in `en`+`ru`, and dates — live-fetched for both lanes now, no curated fallback; Conflicts resolves a start/end range off P580/P585/P582, Milestones resolves a start year/month the same 10-property priority-ordered COALESCE way since no one property reliably holds "the" date across its wider spread of entity shapes (`docs/adr/0015-milestones-taxonomy-expansion-and-date-fetching.md`), plus an end year/month off P582 when the QID has one — a Milestone is period-shaped when that resolves, point-shaped otherwise, the same Conflict/ConflictEvent shape rule (`docs/adr/0016-milestones-can-be-period-shaped.md`)) — not a corpus scan. A further batched Commons `imageinfo` pass (`fetch-image-attribution.ts`) resolves `imageAttribution` for every People/Conflicts/Milestones entity that got an image, keyed by the same ids. Two separate, sequentially-paced Wikipedia REST passes (`fetch-wikipedia-extracts.ts`, one against `en.wikipedia.org` and one against `ru.wikipedia.org`) each resolve an optional `description` (lead-paragraph prose, independent of `tagline`) for every People/Conflicts/Milestones entity with a resolvable article in that language — this pipeline's second live external dependency (alongside Wikidata SPARQL), now queried in two languages. These stages each write one raw file per lane per language where applicable (`<lane>-image-attribution.raw.json`, `<lane>-pageviews.raw.json`, `<lane>-wikipedia-extracts.raw.json` + `<lane>-wikipedia-extracts.ru.raw.json`), not one combined file, so `--lane` can scope a run to just the lane that changed (docs/adr/0012-lane-scoped-fetch.md). All raw output checked into `data/raw/`.
2. **Score** — Conflicts and Milestones: rank by sitelink count, no floor (already hand-vetted curated lists). People: Pantheon's HPI. Two independent tier systems, never blended. Language-independent — scoring never varies between the English and Russian output.
3. **Tag** — Conflicts: curator-assigned `ConflictCategory` passes straight through; region tags keyed off Wikidata country Q-IDs from enrichment. Milestones: curator-assigned `MilestoneCategory` passes straight through; region tags the same way. People: Pantheon's own occupation/country string values onto `OccupationDomain`/`UnRegion`, a fully enumerated closed set. Language-independent, same as Score.
4. **Output** — each lane's `buildPeople`/`buildConflicts`/`buildMilestones` (`write-datasets.ts`) runs twice, once per language (`Lang = 'en' | 'ru'`), against the identical transformed rows: row inclusion is decided once, off English fields only, so both language files always share the same entity set; per-field text (`name`/`tagline`/`description`) resolves to the Russian value when building the Russian file and it's present, English otherwise (`resolveField`/`resolveOptionalField` — see `CONTEXT.md`'s **Field Fallback**). Writes two fully parallel JSON files per lane (`people.json`+`people.ru.json`, etc.) to pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies them into `packages/shared-types`, keeping "compute" and "publish" as separate steps.

No manual override/correction mechanism — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

## Docs

- `docs/code-conventions.md` — pipeline-specific code patterns, file organization
- `docs/adr/` — architecture decision records
