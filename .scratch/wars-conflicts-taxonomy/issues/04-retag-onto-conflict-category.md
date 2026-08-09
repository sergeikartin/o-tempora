# Retag events onto ConflictCategory 1:1, read the 10 new raw files

Type: task
Status: resolved
Blocked by: 02, 03

## Question

`transform/event-type-categories.ts`'s `EVENT_TYPE_CATEGORIES` today collapses 8 Wikidata classes down to just 2 app categories (war→"war", battle/siege/military-operation→"war", treaty/revolution/rebellion/historical-event→"politics"). Replace it with a direct 1:1 map from each of the 10 kept Q-IDs to its own `ConflictCategory` value (no more collapsing — a battle is now tagged "battle", a revolution "revolution", etc.).

`transform/index.ts`'s `transformWars()` currently does `loadRaw("events-historical.raw.json")` (one file) → `groupRows` → `tagHistoricalEvent` → `scoreAndRank`. Update it to load all 10 new raw files from the fetch-split ticket, concatenate their bindings before `groupRows` (or run `groupRows` per file and concatenate the grouped rows — either works since `HISTORICAL_CONFIG` is identical across all 10), then tag as before with the new 1:1 map.

Drop the `?partOfLabelVar`/`partOfLabel` plumbing in `HISTORICAL_CONFIG` (`group-rows.ts`'s `GroupRowsConfig`/`GroupedRow`) as part of this pass if not already removed by the "Remove partOfWarName" ticket — coordinate so it isn't half-removed.

Update `transform/tag-events.test.ts` and `event-type-categories.ts`'s tests for the new 1:1 mapping (no more asserting the old war/politics collapse).

## Answer

Landed. `transform/event-type-categories.ts`'s `EVENT_TYPE_CATEGORIES` rewritten as a direct 1:1 map, keyed off the 9 Q-ID constants "Split fetch into per-category queries" exported from `fetch/queries/historical-events.ts` (`WAR_TYPE_QID` -> `"war"`, `BATTLE_TYPE_QID` -> `"battle"`, ... `PEACE_TREATY_TYPE_QID` -> `"peace-treaty"`) — no more collapsing multiple classes onto a shared "war"/"politics" bucket, resolving the 4 anticipated `tsc` errors the rename/expand ticket left behind.

`transform/index.ts`'s `transformWars()` now iterates `CONFLICT_CATEGORY_QUERIES` (the same list the fetch-split ticket introduced), loading and `groupRows`-ing each of the 9 raw files independently before `.flatMap`-concatenating (not grouping after concatenation) — safe since `HISTORICAL_CONFIG` is identical across all 9, and avoids relying on cross-category id uniqueness. `HISTORICAL_CONFIG`'s `partOfLabelVar` was already dropped by "Remove partOfWarName" landing first, so no coordination needed there.

Rewrote `tag-events.test.ts`: a full 9-case 1:1 mapping table (each surviving Q-ID -> its own category, "no collapsing"), a case confirming the dropped generic treaty QID (`Q131569`) now resolves to `undefined` instead of `"politics"`, and an `EVENT_TYPE_CATEGORIES` entry-count assertion (exactly 9). `npm run typecheck`/`test --workspace packages/data-pipeline` both clean (106/106 tests passing).
