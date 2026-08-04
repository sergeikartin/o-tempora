# packages/data-pipeline — Decisions

<!-- Package-specific architecture decisions. Product scope and invariants: ../../CLAUDE-decisions.md -->

### Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) — Wars/Discoveries source, and People's secondary reign/description enrichment |
| People-lane data source | Pantheon 2.0 (downloaded CSV snapshot, `pantheon-public-data` GCS bucket) |
| bzip2 decompression | `seek-bzip` (pure-JS, no native bindings) — Pantheon's dataset ships `.bz2`; Node has no built-in bzip2 support and no system binary was available |
| Pipeline scripting | Node.js + TypeScript |
| Pipeline intermediate storage | Local JSON/CSV files, checked into the repo |
| Testing | `node:test` |

### System Boundaries

- Pipeline stages: `fetch/` (raw SPARQL results only) → `transform/` (score + tag) → `output/` (writes final JSON into the pipeline's own `data/output/`, then `publish-data` copies it into `packages/shared-types/src/data/`).

### Data Pipeline

Runs on-demand, not continuously — no scheduler, no live connection once data is generated.

1. **Fetch** — People: downloads Pantheon's 2025 Person Dataset CSV, then a batched SPARQL query for one-line descriptions (Pantheon has no description field of its own) keyed on the Wikidata QID Pantheon retains per row, scoped to only the rows that clear the HPI specialist floor. Wars/Discoveries: SPARQL pulls candidate events; a reign/term-of-office query (currently unwired pending People: reign-period secondary enrichment) is parameterized on known person Q-IDs. All written as-is to `packages/data-pipeline/data/raw/`, checked into git for reproducibility.
2. **Score** — fame score is sitelink count directly for Wars/Discoveries; Pantheon's HPI directly for People. Two independent tier systems (`FAME_TIER_MIN_SITELINKS`, `FAME_TIER_MIN_HPI`); no other signal blended into either.
3. **Tag** — Wars/Discoveries: raw Wikidata occupation/location claims mapped onto the app's fixed event-type/region categories via an explicit Q-ID-keyed lookup table (lossy by necessity). People: Pantheon's own `occupation`/`bplace_country`/`dplace_country` string values mapped onto `OccupationDomain`/`UnRegion` via an explicit, fully-enumerated lookup table (no long tail of unmapped values, unlike the Wikidata-QID case).
4. **Output** — final `people.json`/`wars.json`/`discoveries.json` written into the pipeline's own `data/output/` (`npm run build-data`), gitignored — a dataset can be generated and inspected without touching `packages/shared-types`. A separate `npm run publish-data` copies `data/output/`'s contents into `packages/shared-types/src/data/` (the single copy both `packages/data-pipeline` and `packages/web` read from), keeping "compute the dataset" and "publish it for consumers" as two explicit, independently-runnable steps.

No manual override/correction mechanism exists in v1 — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

### Architecture Decisions Log

- Historical events (wars/battles/treaties) and inventions/discoveries are fetched as two separate raw snapshots (structurally different SPARQL queries) and stay separate end to end — Wars & Conflicts (`wars.json`, typed `War[]`) and Discoveries & Inventions (`discoveries.json`, typed `Discovery[]`) are independent lanes with their own tag/score/output, never merged, and no longer share a single `HistoricalEvent` type (`War`/`Discovery` both extend `TimelineEntry`, but `War` alone carries `partOfWarName`). Safe because `tagHistoricalEvent`/`tagInvention` can never produce an overlapping category (`tag-events.test.ts` asserts this), so the split can never lose or duplicate a row.
- Fetch queries never `ORDER BY` sitelinks (times out at this corpus size) — they use a sitelink threshold filter instead; ranking happens in Score.
- `WAR_TYPE_QID` is defined once in Fetch and imported by Transform/Output, so "what counts as a war" has one source of truth.
- A Fetch-stage query can depend on another Fetch-stage query's raw output (the reigns fetch reads the people fetch's output for its candidate ID list) — still consistent with Invariant 8, since it's reading IDs, not reshaping data.
- Output writes into a pipeline-owned `data/output/` (gitignored) rather than directly into `packages/shared-types`; a separate `publish-data` script copies it across. Decouples "the pipeline computes a dataset" from "the dataset is published for consumers" — a dataset can be regenerated and inspected locally without touching `packages/shared-types` until the maintainer chooses to publish it.
- People fully switched from Wikidata to Pantheon 2.0 — a downloaded CSV, not a live query, so the People lane no longer depends on the Wikidata Query Service's live reliability at all. Losing the Wikidata QID as a join key was accepted going in, but turned out unnecessary: Pantheon retains it (`wd_id`), which is why reign periods and descriptions can be sourced from Wikidata as secondary, batched, Q-ID-keyed enrichment passes rather than being dropped entirely. Descriptions are wired in (`fetch-descriptions.ts`); reign periods still use the old fetch-reigns.ts input path and aren't re-wired yet (People: reign-period secondary enrichment, `.scratch/alt-data-sources/issues/19-people-reign-periods-enrichment.md`). `Person.category`/`occupationTags`/`regionTags: Region[]` became `occupationDomain: OccupationDomain` (single-valued — Pantheon's `occupation` field has no multi-value case Wikidata's did) and `regionTags: UnRegion[]` (the UN M49 geoscheme, present-day-location-based — a deliberate simplification versus `HistoricalEvent`'s historical-polity-aware `Region`, since Pantheon has no historical-nationality field).
- Pantheon's CSV has no description field. Rather than accept a missing/synthetic description or add a new live dependency (e.g. Wikipedia's REST API), descriptions are fetched via the existing batched-SPARQL pattern (`fetch-descriptions.ts`, mirrors `fetch-reigns.ts`), keyed on `wd_id`, scoped to only the rows clearing the HPI specialist floor (~3,840 of 126,582) — reuses already-hardened retry/batching infrastructure instead of introducing a second kind of live fetch.
- `wikipediaUrl` for People is derived deterministically from Pantheon's `slug` column (`https://en.wikipedia.org/wiki/{slug}`), not fetched — Pantheon guarantees every row has one, unlike Wikidata's optional `schema:about`/`isPartOf` join.
