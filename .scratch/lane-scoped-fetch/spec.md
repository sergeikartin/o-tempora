Labels: ready-for-agent

# Data pipeline: lane-scoped fetch

## Problem Statement

`npm run fetch` (`packages/data-pipeline/src/fetch/index.ts`) always runs all eight fetch stages for all three lanes (People, Wars & Conflicts, Events & Inventions) in one process, with no way to scope a run to a single lane. Adding one entry to the Events & Inventions curated list (`data/raw/events-curated.raw.json`) and re-fetching to pick it up means re-running the entire pipeline, including the ~35-minute `fetchWikipediaExtracts` stage across all ~4,150 People + 154 Wars + 121 Discoveries entities (observed timing, `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md`), even though only ~121 entities are affected.

Most fetch stages are already lane-independent in code (`fetchPantheon`/`fetchTaglines`/`fetchReigns` for People, `fetchEventsEnrichment`/`fetchWarsEnrichment` for their own lanes). The blocker is the three stages that read and combine all three lanes' data in a single pass and overwrite one shared raw file each run: `fetchImageAttribution` → `image-attribution.raw.json`, `fetchPageviews` → `pageviews.raw.json`, `fetchWikipediaExtracts` → `wikipedia-extracts.raw.json`.

## Solution

Add a `--lane=<value>` flag to `npm run fetch` (`people`/`wars`/`discoveries`; no flag = all three, unchanged from today's behavior). Split the three combined-output stages so each writes one raw file per lane instead of one file for all three, so a lane-scoped run only touches that lane's own raw files. `transform/index.ts`'s three loaders (`loadImageAttributionFile`, `loadPageviewsFile`, `loadWikipediaExtractsFile`) read the new per-lane files instead of picking a sub-object out of one combined file.

`discoveries` is the canonical lane name for Events & Inventions in this new surface (the CLI flag value and the new split file names), matching the name the shipped output type/file already use (`Discovery`, `discoveries.json`, `DiscoveryCategory`) rather than "events," which the pre-existing fetch-stage code and curated file use internally. That existing internal "events" naming (`events-curated.raw.json`, `fetchEventsEnrichment`, `CuratedEvent`, etc.) is left untouched — renaming it is a separate, later effort (see Out of Scope).

Because `fetchWikipediaExtracts`'s ~2 req/sec pacing was deliberately kept as one shared ceiling specifically so lanes never hit Wikipedia concurrently, running two lane-scoped fetches at the same time (two terminals) would defeat that. This is handled as a documented convention, not a lock — the pipeline is on-demand/solo-maintainer with no CI or scheduler (per `packages/data-pipeline/CLAUDE.md`), so a hard guard isn't proportionate.

`build-data`/`publish-data` are untouched — they make no network calls (confirmed: no `fetch()` calls anywhere in `src/transform/` or `src/output/`) and are already fast, so lane-scoping them would add complexity with no bottleneck to fix.

## User Stories

1. As the curator, I want `npm run fetch --workspace packages/data-pipeline -- --lane=discoveries` to fetch and enrich only the Events & Inventions lane, so that adding one entry to the curated list doesn't cost a ~35-minute full re-fetch dominated by ~4,150 unrelated People entities.
2. As the curator, I want the same `--lane` capability for `people` and `wars`, symmetrically, so all three lanes benefit and the mechanism isn't a one-off special case wired only for Discoveries.
3. As the curator, I want `npm run fetch` with no `--lane` flag to behave exactly as it does today (fetch everything), so existing muscle memory and CI-adjacent tooling (if any is ever added) doesn't break.
4. As a developer, I want the three cross-lane stages (`fetchImageAttribution`, `fetchPageviews`, `fetchWikipediaExtracts`) to each write one raw file per lane rather than a single combined file, so a lane-scoped fetch's output is fully self-contained and doesn't require read-modify-write merge logic against a shared file.
5. As a developer, I want `transform/index.ts`'s three loaders updated to read the new per-lane files, so Transform keeps working once Fetch stops producing the old combined files.
6. As the maintainer, I want the three existing checked-in combined raw files split into per-lane files by a one-time, network-free migration script, so ~35 minutes of already-fetched data isn't discarded and a full re-fetch isn't forced just to adopt the new file layout.
7. As a future reader, I want the combined-file → per-lane-file split and the "don't run concurrent lane fetches" convention recorded in an ADR, so the reasoning (especially the deliberate shared-rate-ceiling comment in `fetch-wikipedia-extracts.ts`, which this change relies on being safe only because lane fetches are meant to run one at a time) isn't rediscovered by future-me the hard way.

## Implementation Decisions

- **CLI shape**: single `fetch` npm script, `--lane=<value>` flag (`people`/`wars`/`discoveries`), default behavior (no flag) unchanged — runs all three lanes in today's existing order.
- **New per-lane raw file names**, following the existing `<lane>-<descriptor>.raw.json` convention already used by `people-taglines.raw.json`/`wars-curated-enriched.raw.json`/etc.:
  - `fetchImageAttribution` → `people-image-attribution.raw.json`, `wars-image-attribution.raw.json`, `discoveries-image-attribution.raw.json`
  - `fetchPageviews` → `wars-pageviews.raw.json`, `discoveries-pageviews.raw.json` (People has no pageviews stage today — Score's People path uses Pantheon HPI directly, untouched by ADR 0010 — so no `people-pageviews.raw.json`)
  - `fetchWikipediaExtracts` → `people-wikipedia-extracts.raw.json`, `wars-wikipedia-extracts.raw.json`, `discoveries-wikipedia-extracts.raw.json`
- **Old combined files removed** (`image-attribution.raw.json`, `pageviews.raw.json`, `wikipedia-extracts.raw.json`) once the one-time migration script has split them and `transform/index.ts` reads the new files.
- **Migration script**: one-off, pure local JSON reshape (reads the three existing combined files, writes the new per-lane files, no network calls), run once and then deletable — not a reusable/rerunnable tool, same posture as other one-off pipeline scripts in this repo (e.g. the Wars curated-list bootstrap script).
- **Orchestration** (`fetch/index.ts`): a lane-scoped run executes only that lane's slice of the existing dependency chain — e.g. `--lane=discoveries` runs `fetchEventsEnrichment()` then the discoveries slice of `fetchImageAttribution`/`fetchPageviews`/`fetchWikipediaExtracts`, preserving the existing "must run after enrichment" ordering already documented in `fetch/index.ts`'s comments, just scoped to one lane's entities.
- **Concurrency**: no lockfile/guard. Documented as a convention in `packages/data-pipeline/CLAUDE.md`, next to the `fetch` script's description: don't run two lane-scoped fetches at the same time, since `fetchWikipediaExtracts`'s shared pacing assumes only one lane is hitting Wikipedia at once.
- **`data-pipeline/CLAUDE.md` and `docs/troubleshooting.md`**: updated to document `--lane` as the preferred way to re-run a single lane's fetch, in place of (or alongside) the existing documented pattern of invoking an individual stage file directly via `npx tsx`.
- **`CONTEXT.md`**: already updated with a new **Lane** entry recording the `people`/`wars`/`discoveries` CLI vocabulary and the "discoveries" vs. legacy-internal-"events" naming split (done during the grilling session that produced this spec).

## Testing Decisions

- Each split stage (`fetchImageAttribution`, `fetchPageviews`, `fetchWikipediaExtracts`) gets test coverage confirming a lane-scoped call writes only that lane's file(s) and leaves the others' untouched — mirroring how this repo's existing `fetch/*.test.ts` files test pipeline stages as pure functions where possible.
- `transform/index.test.ts`: update fixtures/mocks for the three loaders to reflect the new per-lane file reads.
- The migration script itself: not unit tested, consistent with this codebase's existing convention of not testing one-off/non-reusable scripts (e.g. the Wars curated-list bootstrap script) — verified once, manually, against the real checked-in combined files before they're deleted.
- Not covered by new tests: the live network-dependent fetch calls themselves (`fetchPantheon`, the SPARQL/REST clients) — consistent with every other `fetch/fetch-*.ts` entrypoint in this codebase.

## Out of Scope

- Renaming the pre-existing "events" internal naming (`events-curated.raw.json`, `events-curated-enriched.raw.json`, `fetchEventsEnrichment`, `CuratedEvent`, etc.) to "discoveries" — real, but deliberately deferred to a separate issue/effort so it doesn't get bundled into this one (see `.scratch/discoveries-file-rename/spec.md`).
- Lane-scoping `build-data`/`publish-data` — no network I/O, not a bottleneck, no flag added.
- A concurrency lock/guard preventing simultaneous lane fetches — documented convention only.
- Fixing the stale root `CLAUDE.md` claim that a `CONTEXT-MAP.md` and per-package `CONTEXT.md` files exist (they don't — only the single root `CONTEXT.md` does) — unrelated pre-existing doc inconsistency, noted during this session but out of scope here.

## Further Notes

- Precedent for the combined-file structure being split by lane: none directly, but the existing `<lane>-<descriptor>.raw.json` naming convention (People/Wars/Discoveries already have their own separate curated/enrichment files) is what this migration extends to the three stages that hadn't followed it yet.
- Relevant existing ADR context: `docs/adr/0001-wars-discoveries-people-separate-lanes.md` (lanes already separate end-to-end at fetch/score/tag/output — this spec closes the one remaining gap, the three combined-output fetch stages) and `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` (source of the ~35 min timing figure and the "no caching across runs" convention, which this spec doesn't change — a lane-scoped fetch still refetches its lane's entities in full every time, it just no longer refetches the *other* lanes too).
