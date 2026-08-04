Status: ready-for-agent

# Spec: Alternative data sources for the history-timeline pipeline

Source map: [Alternative data sources for the history-timeline pipeline](map.md) — this spec synthesizes all 15 resolved decision tickets on that map. Zoom into individual tickets under `issues/` for full rationale where this spec only gists a decision.

## Problem Statement

`packages/data-pipeline`'s three lanes — People, Wars & Conflicts, and Discoveries & Inventions — are all sourced by live-querying the Wikidata Query Service (SPARQL) at Fetch time. That live endpoint is unreliable: the most recent Fetch run hit widespread 502s/timeouts across nearly every era bucket in the People fetch, then crashed uncaught while fetching inventions candidates, leaving `data/raw/*.json` as partial, uncommittable overwrites the maintainer had to manually recover from. Beyond reliability, Wikidata-sourced data quality has real gaps: occupation/region tagging depends on a large, still-growing manual Q-ID lookup-table backlog, and fame ranking is a blunt sitelink count with no purpose-built "fame" signal behind it.

## Solution

Move the People lane fully onto Pantheon 2.0, a purpose-built "famous biographies" dataset downloaded once as a static file (no live query dependency at all), with its own fame metric (HPI) replacing sitelink-based tiers. Move the Wars & Conflicts lane's 1600–1973 coverage onto CDB90, a purpose-built historical-battles dataset with accurate, directly-parseable war-level date ranges, while keeping Wikidata for everything outside that window. Leave Discoveries & Inventions on Wikidata, but fix the specific, now-diagnosed reliability bugs (missing error handling, 502/503/504 never retried, no era-bucketing on two of the four query shapes) that caused the most recent failures. Preserve the existing "reign periods" feature for People via a small secondary Wikidata lookup keyed on the Q-ID Pantheon still carries per row. Add local download scripts for each new external raw source, mirroring the existing pattern of raw snapshots checked into git for reproducibility. Accept CC BY-SA 4.0 obligations for Pantheon-derived data as the project's first explicit data-licensing stance.

## User Stories

1. As a pipeline maintainer, I want the People lane to stop depending on live Wikidata SPARQL queries, so that a Fetch run no longer fails with 502s/timeouts across most of the People dataset.
2. As a pipeline maintainer, I want a script that downloads Pantheon's 2025 Person Dataset CSV to a local raw file, so that People-lane data is reproducible and checked into git like the existing Wikidata raw snapshots.
3. As a pipeline maintainer, I want Pantheon's raw CSV rows typed against their actual column shape before anything touches them, so that Transform-stage bugs show up as type errors, not silent `undefined` access.
4. As a pipeline maintainer, I want a single mapping function from a raw Pantheon row to a `Person`, so that the transformation logic is unit-testable without any network access.
5. As an app visitor, I want People's fame tiers to be based on Pantheon's HPI metric, so that "how famous is this person" reflects a purpose-built popularity signal instead of a raw sitelink count.
6. As a pipeline maintainer, I want the HPI fame-tier floors (90/85/75) applied against `Person.fameScore`, so that the three tiers stay strictly nested the same way the current sitelink tiers are.
7. As a pipeline maintainer, I want Pantheon's flat 101-value `occupation` field mapped onto a new `OccupationDomain` type (Pantheon's own 8 domains: sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration), so that People retain an occupation-based classification without inheriting Wikidata's Q-ID lookup-table backlog.
8. As a pipeline maintainer, I want `Category` to remain untouched and used only by `HistoricalEvent` going forward, so that Wars/Events keep their existing event-type classification (`war`, `invention`, `religion`, etc.) unaffected by the People-lane change.
9. As a pipeline maintainer, I want Pantheon's `bplace_country`/`dplace_country` fields mapped onto a new `UnRegion` type (the UN M49 geoscheme's 22 sub-regions), so that People retain a region-based classification without needing historical-polity-aware tagging Pantheon can't provide.
10. As a pipeline maintainer, I want `Region` to remain untouched and used only by `HistoricalEvent` going forward, so that Wars/Events keep their existing historical-polity-aware region tagging (e.g. Byzantine Empire → `europe`) unaffected.
11. As a pipeline maintainer, I want the `bplace_country`/`dplace_country` → `UnRegion` crosswalk built once from Pantheon's live `/country` endpoint and hardcoded into the pipeline, so that no live dependency exists at actual Fetch time.
12. As a pipeline maintainer, I want the country-name join between Pantheon's person rows and its country lookup to key on ISO country codes rather than raw name strings, so that mismatches like `"Bahamas, The"` vs `"The Bahamas"` don't silently drop region tags.
13. As an app visitor, I want ruler/office-holder reign-period overlays to keep working after the People switch, so that a feature I already see today doesn't quietly disappear.
14. As a pipeline maintainer, I want the reign-periods lookup to run as a secondary enrichment keyed on Pantheon's retained `wd_id` column, so that the existing batched Q-ID query mechanism needs no structural change.
15. As a pipeline maintainer, I want a script that downloads CDB90's `battles.csv` to a local raw file, so that Wars-lane CDB90 data is reproducible and checked into git like the existing Wikidata raw snapshots.
16. As a pipeline maintainer, I want CDB90's raw battle rows typed against their actual column shape before anything touches them, so that only the fields actually consumed (`war4`, `isqno`, `name`, `dbpedia`) need to be modeled, not all 49 CDB90 columns.
17. As a pipeline maintainer, I want war-level date ranges parsed directly from CDB90's `war4` field (`"War Name of START-END"`), so that no lossy min/max-battle-date derivation is needed.
18. As a pipeline maintainer, I want the one known `war4` data typo (`"World War II of 1939-194"`) corrected during parsing, so that a truncated year doesn't produce a garbage date.
19. As an app visitor, I want wars in the 1600–1973 range to show accurate start/end dates, so that a war like the Thirty Years' War displays its true historical span (1618–1648) rather than an undershoot derived from battle coverage.
20. As a pipeline maintainer, I want the Wikidata Wars query restricted to exclude the 1600–1973 window CDB90 now covers, so that the same historical war doesn't appear twice in `wars.json` from two different sources.
21. As a pipeline maintainer, I want individual CDB90 battles modeled as point events linked to their parsed war-level parent (mirroring the existing `partOfWarName` pattern for Wikidata-sourced battles/treaties), so that the Wars lane's existing war/battle/treaty structure stays consistent regardless of source.
22. As a pipeline maintainer, I want the Discoveries & Inventions lane to stay on Wikidata rather than integrate a second external source, so that the pipeline doesn't take on hybrid-merge complexity for a dataset (Vetustas) that isn't a clear improvement over what's already produced.
23. As a pipeline maintainer, I want `fetchEvents()`'s two `fetchAllPages` calls wrapped in try/catch (matching the existing pattern in the people/reigns fetchers), so that one failed query no longer crashes the entire Fetch run before other stages can complete.
24. As a pipeline maintainer, I want `runSparqlQuery` to retry on HTTP 502/503/504 with exponential backoff, not just HTTP 429, so that the specific failure class actually observed gets retried per Wikidata's own operational guidance.
25. As a pipeline maintainer, I want the client-side request timeout raised toward Wikidata's documented 60-second hard deadline, so that legitimately-slow-but-healthy queries aren't self-aborted at 30 seconds before the server would have finished them.
26. As a pipeline maintainer, I want the historical-events and inventions queries era-bucketed the same way the people query already is, so that one troublesome date range can't starve the rest of the corpus and so a single bucket's failure doesn't threaten the whole run.
27. As a pipeline maintainer, I want a courtesy delay inserted between people-fetch era buckets (matching the existing delay pattern between pages and between reign batches), so that the one gap in the codebase's "pause between requests" convention is closed.
28. As a project maintainer, I want a data-license notice covering Pantheon-derived fields as CC BY-SA 4.0, plus an in-app attribution credit citing Yu et al. 2016, so that the project meets its first explicit data-licensing obligation.
29. As a project maintainer, I want CDB90's ODC-BY attribution requirement met the same way, so that both new external sources are properly credited.
30. As a pipeline maintainer, I want all new Pantheon-row-mapping and CDB90-`war4`-parsing logic covered by fixture-based unit tests, so that regressions in date/tier/taxonomy mapping are caught without needing live network access in CI or locally.
31. As a pipeline maintainer, I want Wars & Conflicts and Discoveries & Inventions written to two separate output files (`wars.json`, `discoveries.json`) instead of one merged file, so that the Transform stage no longer needs a wars/inventions merge step and CDB90-sourced wars can never end up mixed into Discoveries & Inventions data.

## Implementation Decisions

### Shared types (`packages/shared-types`)

- `Category` is unchanged and becomes exclusively `HistoricalEvent`'s classification going forward.
- `Region` is unchanged and becomes exclusively `HistoricalEvent`'s classification going forward.
- New `OccupationDomain` type (8 values: `sports`, `institutions`, `arts`, `humanities`, `science-technology`, `business-law`, `public-figure`, `exploration`) replaces `Person.category`/`Person.occupationTags`. Given Pantheon's `occupation` field is single-valued per person, this collapses to a single field (e.g. `occupationDomain: OccupationDomain`), not an array — the existing `occupationTags` array shape was needed for Wikidata's potentially-multiple-occupation model, which no longer applies once People fully leaves Wikidata.
- New `UnRegion` type (the UN M49 geoscheme's 22 sub-regions) replaces `Person.regionTags: Region[]` with `Person.regionTags: UnRegion[]` (same field name and array shape retained, since a person's birth region and death region can genuinely differ and both are worth keeping as tags).
- `Person.fameScore` is populated directly from Pantheon's `hpi` field (0–100 scale) for People, exactly as it's currently populated directly from sitelink count — no new field needed, no rescaling.
- `HistoricalEvent` gets no new fields for the CDB90 hybrid — CDB90-sourced wars populate the existing `date`/`endDate`/`partOfWarName`/`category`/`regionTags` fields exactly as Wikidata-sourced wars already do.

### Fetch stage (`packages/data-pipeline/fetch`)

- New raw-shape types matching each external source's actual format, kept separate from the app's `Person`/`HistoricalEvent` types and validated at the Fetch boundary — this mirrors the existing pattern already used for Wikidata's raw SPARQL result shape (validated before Transform ever sees it, per the standing "validate unknown external input at system boundaries" rule):
  - A Pantheon person-row type covering the CSV columns actually consumed: `id`, `wd_id`, `name`, `occupation`, `hpi`, `bplace_country`, `dplace_country`, `birthyear`, `deathyear`, `alive`.
  - A CDB90 battle-row type covering the columns actually consumed: `isqno`, `name`, `war4`, `dbpedia`.
- New download script for Pantheon: fetches the public, unauthenticated 2025 Person Dataset (`.csv.bz2`) from its GCS bucket URL, decompresses it, and writes the raw CSV into the pipeline's raw-snapshot directory, matching the existing Wikidata raw-file-checked-into-git convention.
- New download script for CDB90: fetches `battles.csv` from the public GitHub raw URL and writes it into the same raw-snapshot directory. No other CDB90 files are needed — only `war4`/`isqno`/`name`/`dbpedia` from `battles.csv` are consumed; `battle_durations.csv` and the rest of the repo's tables are not used, since `war4` alone supplies accurate war-level dates.
- No download script is needed for the Wikidata-sourced portions (People has none anymore; Wars' non-1600–1973 range and Discoveries & Inventions keep using the existing live SPARQL client, reliability-patched as below).
- The existing Wikidata Wars query gains a date-range exclusion for 1600–1973 (the CDB90-covered window), to prevent the same historical war appearing twice in the merged output.
- Wikidata reliability fixes, all scoped to `wikidata-client.ts`/`fetch-events.ts`/`fetch-people.ts` (per the query-reliability research, priority order):
  1. `runSparqlQuery` retries HTTP 502/503/504 with exponential backoff, not just 429.
  2. `fetchEvents()`'s two `fetchAllPages` calls get try/catch guards matching the existing per-bucket/per-batch pattern in `fetchPeople`/`fetchReigns`.
  3. The client-side request timeout is raised toward Wikidata's documented 60-second hard deadline.
  4. The historical-events and inventions query builders gain the same `[minYear, maxYearExclusive)` era-bucketing parameter `buildPeopleQuery` already has, and `fetch-events.ts` loops over buckets the way `fetch-people.ts` already does.
  5. A courtesy delay is added between people-fetch era buckets, matching the existing between-page and between-batch delay pattern.
  - Reducing `OPTIONAL`-clause count (a lower-priority option from the research) is not required by this spec; leave as a documented future option if reliability issues persist after 1–5.

### Transform stage (`packages/data-pipeline/transform`)

- A mapping function from the new Pantheon raw-row type to `Person`, composing: direct field mapping for `birthYear`/`deathYear` (Pantheon's `birthyear`/`deathyear` are already plain integers, negative for BCE — no date-string parsing is needed), the `OccupationDomain` lookup (new 101-value table, same shape/pattern as the existing `occupation-categories.ts`), the `UnRegion` lookup (new hardcoded country-code-keyed table sourced from Pantheon's `/country` endpoint), and direct `fameScore = hpi` assignment.
- A new `FAME_TIER_MIN_HPI` constant (`generalPublic: 90, educated: 85, specialist: 75`), parallel to and independent of the existing `FAME_TIER_MIN_SITELINKS` (which remains unchanged and continues to apply to Wars & Conflicts and Discoveries & Inventions).
- A mapping/parsing function from CDB90's `war4` string to `{ name, startYear, endYear }`, via regex extraction of the trailing `of START-END`/`of YEAR` pattern, with a hardcoded correction for the one known truncated-year row.
- Individual CDB90 battles map to point `HistoricalEvent`s with `partOfWarName` set to the parsed war name, mirroring how individual Wikidata-sourced battles/treaties already link to their parent war.
- Reign-period enrichment continues to use the existing batched Q-ID SPARQL mechanism, now sourced from Pantheon's retained `wd_id` column instead of a primary Wikidata people scan.

### Output stage (`packages/data-pipeline/output`)

- The Output stage writes **two** files instead of one merged `events.json`: `wars.json` (Wars & Conflicts) and `discoveries.json` (Discoveries & Inventions — renamed from the current `events.json`, since "events" no longer distinguishes the lane once wars have their own file). Both continue to use the unchanged `HistoricalEvent` type — this is a file-splitting-and-renaming decision, not a type split; `partOfWarName` simply stays unpopulated for Discoveries & Inventions entries, as it already does today. Consequently, the Transform stage no longer merges Wars and Discoveries & Inventions at any point — each lane's raw snapshot flows through Score/Tag/Output independently, which also means CDB90-sourced wars can never end up mixed into Discoveries & Inventions data.
- A data-license notice (mechanism: a dedicated notice file, following the existing convention of static generated artifacts living alongside the pipeline's output) records CC BY-SA 4.0 attribution for Pantheon-derived fields (citing Yu et al. 2016) and ODC-BY attribution for CDB90-derived fields. The in-app credit surface (an About/Sources page or footer) is a `packages/web` concern, out of scope for this pipeline-focused spec.

## Testing Decisions

Good tests here verify external behavior (given a raw input row, what `Person`/`HistoricalEvent` comes out) rather than internals, matching this codebase's existing pipeline-test style (`group-rows.test.ts`, `score.test.ts`, the `queries/*.test.ts` files) — pure functions exercised with fixture data, no network I/O anywhere in the test suite.

- **Pantheon row → `Person` mapping**: fixture rows covering a normal row, a BCE `birthyear`, an unmapped/unknown `occupation` value, and an unmapped/unknown `bplace_country` value (asserting a defined fallback rather than a silent crash).
- **CDB90 `war4` → date range**: fixture strings covering the standard range case, the single-year case, and the known truncated-typo case, asserting the corrected output.
- **`FAME_TIER_MIN_HPI` tier assignment**: fixture HPI values at and around each of the 90/85/75 floors, asserting nesting (a `generalPublic`-tier person is also `educated`- and `specialist`-tier).
- **Output stage**: extend the existing `write-datasets.test.ts` pattern to cover the new license-notice output, following its existing fixture/assertion style.
- **Not tested**: the download scripts themselves (network I/O, explicitly out of scope for unit tests per this spec), and the Wikidata reliability fixes (retry/backoff/timeout behavior) — these are verified by a live re-run of the pipeline, not mocked-network unit tests, consistent with not testing network I/O anywhere in this effort.
- The two new lookup tables (`OccupationDomain`, `UnRegion`) are treated as data, not separately unit-tested — matching how the existing `occupation-categories.ts`/`region-categories.ts` tables aren't separately tested today; coverage comes from the mapping functions that consume them.

## Out of Scope

- Kaggle "World History of Wars and Demographics" — superseded by CDB90 during charting.
- Scraping britannica.com/topic/war — rejected: unstructured, blocked automated access, legal/ToS risk.
- Vetustas Archiva for Discoveries & Inventions — rejected: comparable scale to existing Wikidata output, inconsistent metadata, not worth the hybrid-integration cost.
- Chasing Pantheon's `birth_civ` field for historical-nationality-aware People region tagging — rejected: would require a live per-person API dependency across all 126,582 rows, reintroducing the reliability problem this spec exists to fix.
- A bulk Wikidata data-dump ingestion path — rejected in favor of redesigning the live query/retry strategy.
- Any `packages/web` changes: the fame-tier selector UI (already separately tracked as Unit 9), any `OccupationDomain`/`UnRegion` filter UI, the attribution/credits page or footer, and updating the frontend's data loading to read two files (`wars.json`/`discoveries.json`) instead of one. This spec covers `packages/data-pipeline` and `packages/shared-types` only.
- A manual data-correction/override mechanism — remains out of scope per the pipeline's standing invariant; corrections still mean fixing Score/Tag logic and re-running.
- Reducing `OPTIONAL`-clause count in the historical-events/people queries (a lower-priority reliability option) — left as a documented future option, not required by this spec.

## Further Notes

- **Open gap surfaced while writing this spec, not covered by any resolved ticket**: CDB90-sourced wars/battles have no fame signal — CDB90 carries no sitelink data, and its DBpedia crosswalk (usable for a sitelink lookup via Wikidata) is only 62.7% filled overall, dropping to 37.7% for 20th-century wars. `wars.json` still uses the existing `fameScore`/`FAME_TIER_MIN_SITELINKS` system (unaffected by the output split), so CDB90 entries need *some* `fameScore` to sort/filter consistently alongside Wikidata-sourced wars, and no source or scheme for that value was decided on the map. **Recommend resolving this as a follow-up wayfinder ticket before implementation starts** — the map should be reopened rather than this spec silently inventing a scoring scheme.
- The individual-CDB90-battles-as-point-events decision (Implementation Decisions, Transform stage) was inferred here for consistency with the existing product model, not explicitly re-confirmed on the map during grilling — worth a quick sanity check before implementation, since the map's tickets focused on war-level ranges specifically.
- This spec spans `packages/shared-types` and `packages/data-pipeline` — per the project's layering rules, implementation should split into ordered units (shared-types type changes first, since both other packages depend on them; then Fetch; then Transform; then Output), each its own unit of work with a review checkpoint, not one combined change.
- `packages/data-pipeline/CLAUDE.md`/`CLAUDE-decisions.md` currently document occupation/region tagging as a single pipeline-wide QID-keyed lookup-table approach — this spec makes that lane-specific (Wars/Events keep the QID-keyed approach; People does not). Update those docs in the same unit of work that implements the People-lane Tag stage, per the project's "don't leave docs stale" rule.
- Root `CLAUDE-decisions.md`'s documented storage model (`people.json`/`events.json`) also needs updating to reflect the new `wars.json`/`discoveries.json` split and rename, in the same unit of work that implements the Output-stage split. This also touches the product's documented three-lane naming ("Events & Inventions" → "Discoveries & Inventions") in the root `CLAUDE-decisions.md` Product Overview — a naming change beyond just this pipeline spec, worth confirming is intended to propagate everywhere that lane is named (frontend labels, other docs), not just the pipeline output file.
