# Extend range-bar rendering to war-of-independence alongside war

Type: task
Status: resolved

## Question

Today `output/write-datasets.ts`'s `buildWars()` decides War (range bar, a real `Period`) vs WarEvent (point) with a single check: `row.tags.includes(WAR_TYPE_QID)` (`Q198` only) — see the comment block above `buildWars` and the shared-types comment on `War`/`WarEvent`. Per the map's destination, war-of-independence (`Q1006311`) is definitionally a multi-year conflict with real start/end dates (same P580/P582 pattern) and should join `war` as a second bar-rendering type.

Generalize the check to a small set, e.g. a `BAR_RENDERED_TYPE_QIDS = new Set([WAR_TYPE_QID, WAR_OF_INDEPENDENCE_QID])` (name and location as fits — could live alongside `WAR_TYPE_QID` in `fetch/queries/historical-events.ts`, or wherever the per-category query builders from the fetch-split ticket end up defining their Q-ID constants). Update the `shared-types/src/index.ts` comment on `War`/`WarEvent` ("Only entities Wikidata classes as a war... become a War") to describe the (now two-member) rule instead of a single QID.

This is independent of the ConflictCategory rename/retagging tickets — the bar-vs-point split is driven by the raw Wikidata `?type` tag, not by the app-level category value, so it can land before or after them without conflict (though touches some of the same files, so coordinate to avoid merge noise).

## Answer

Landed alongside "Split fetch into per-category queries" (same files). `BAR_RENDERED_TYPE_QIDS = new Set([WAR_TYPE_QID, WAR_OF_INDEPENDENCE_TYPE_QID])` now lives in `fetch/queries/historical-events.ts`, next to the per-category Q-ID constants that ticket introduces. `output/write-datasets.ts`'s `buildWars` check changed from `row.tags.includes(WAR_TYPE_QID)` to `row.tags.some((tag) => BAR_RENDERED_TYPE_QIDS.has(tag))`. `shared-types/src/index.ts`'s `War` doc comment rewritten to describe the two-member rule instead of a single QID. Added a `write-datasets.test.ts` case confirming a war-of-independence-tagged row builds a `War` with `period.end`, alongside the existing war-type case.
