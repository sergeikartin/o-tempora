# Split the historical-events fetch into 9 per-category SPARQL queries

Type: task
Status: resolved
Blocked by: 01

## Question

Replace the single combined query in `fetch/queries/historical-events.ts` (one `VALUES ?type {...}` list of 8 classes, one shared `MIN_SITELINKS=30` floor) with 9 per-category query builders — one per `ConflictCategory` value (war `Q198`, battle `Q178561`, siege `Q188055`, military-operation `Q645883`, revolution `Q10931`, rebellion `Q124734`, coup-d'état `Q45382`, war-of-independence `Q1006311`, peace-treaty `Q625298`) — each filtered by its own fetch-time sitelink floor per the "Per-category sitelink fame-tier floors" ticket's answer (flat 70 across all 9), instead of one shared `MIN_SITELINKS`. Armistice (`Q107706`) is dropped — see that ticket's answer.

Each query keeps the existing shape (date/endDate via P585/P580/P582 with precision, English label, P17 country, English Wikipedia article, English description) minus the `?partOfLabel`/P361 block, which the "Remove partOfWarName" ticket drops entirely — don't re-add it here even temporarily.

`fetch-historical-events.ts`'s era-bucketed-fetch orchestration (`ERA_BUCKETS`, per-bucket try/catch, `fetchBucketed`) is sound and type-agnostic — reuse it per category rather than rewriting it, calling it once per category and writing each category's results to its own raw file (`events-war.raw.json`, `events-battle.raw.json`, ... `events-peace-treaty.raw.json`), per the map's "one raw file per type" decision.

Keep (or relocate) the `WAR_TYPE_QID` export — it's still the source-of-truth Q-ID other modules key off, though the "Extend range-bar rendering to war-of-independence" ticket will generalize its single-QID usage in `write-datasets.ts` to a small set.

Drop the generic "treaty" (`Q131569`) and generic "historical event" (`Q13418847`) classes entirely — they're not part of the new 10.

## Answer

Landed. `fetch/queries/historical-events.ts`'s single combined `EVENT_TYPES` VALUES-clause query is replaced with `buildHistoricalEventsQuery(typeQid, limit, offset, minYear, maxYearExclusive)`, parameterized on one Q-ID at a time (`?event wdt:P31 wd:${typeQid}` + `BIND(wd:${typeQid} AS ?type)` instead of a VALUES list) — same date/endDate/label/country/article/description OPTIONAL shape as before, `?partOfLabel` already dropped by "Remove partOfWarName". Exported per-category Q-ID constants (`WAR_TYPE_QID`, `BATTLE_TYPE_QID`, ... `PEACE_TREATY_TYPE_QID`, 9 total, armistice excluded) plus `CONFLICT_CATEGORY_QUERIES: ConflictCategoryQuery[]` (category + typeQid + rawFileName, one entry per surviving `ConflictCategory` value) so both `fetch-historical-events.ts` and (later) `transform/index.ts` can iterate the same list rather than duplicating it.

`fetch-historical-events.ts`'s `fetchHistoricalEvents` now loops `CONFLICT_CATEGORY_QUERIES`, calling the existing `fetchBucketed` orchestration once per category (unchanged — still era-bucketed, still per-bucket try/catch) and writing each category's bindings to its own raw file: `events-war.raw.json`, `events-battle.raw.json`, `events-siege.raw.json`, `events-military-operation.raw.json`, `events-revolution.raw.json`, `events-rebellion.raw.json`, `events-coup-d-etat.raw.json`, `events-war-of-independence.raw.json`, `events-peace-treaty.raw.json`. `MIN_SITELINKS` (`fetch/queries/min-sitelinks.ts`) updated from the old shared floor of 30 to the flat per-category fetch floor of 70, per "Per-category sitelink fame-tier floors"' Answer.

`WAR_TYPE_QID` kept as the source-of-truth Q-ID other modules key off, per this ticket's instructions — but its single-QID usage in `write-datasets.ts`'s bar-vs-point check is generalized to `BAR_RENDERED_TYPE_QIDS` (a 2-member `Set` also including `WAR_OF_INDEPENDENCE_TYPE_QID`) as part of landing "Extend range-bar rendering to war-of-independence" in the same pass, since both tickets touch this file and the map's own notes call out coordinating to avoid merge noise.

The old combined `events-historical.raw.json` (checked into `data/raw/`) is now unused by fetch — left in place until the live pipeline run ("Run the restructured pipeline end-to-end and publish fresh data") replaces it with the 9 new files and removes it, so the working tree doesn't carry a half-migrated raw-data state before that ticket's real fetch actually produces the replacements. `transform/index.ts` and `transform/list-unmapped-countries.ts` still read the old single file — that's "Retag events onto ConflictCategory 1:1"'s and "Reconcile region-tag mapping"'s job respectively, both blocked on this ticket for exactly that reason.

`historical-events.test.ts` rewritten for the new `(typeQid, limit, offset, minYear, maxYearExclusive)` signature, plus new tests for `CONFLICT_CATEGORY_QUERIES` (9 entries, distinct raw file names) and `BAR_RENDERED_TYPE_QIDS` (exactly war + war-of-independence).
