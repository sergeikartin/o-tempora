# 18 — Output: split into wars.json/discoveries.json

**What to build:** The pipeline's Output stage stops merging Wars & Conflicts and Discoveries & Inventions into one `events.json` and instead writes two independent files. This restructures only how today's existing Wikidata-sourced data is written — no new external data source is involved yet.

**Blocked by:** 22 — Output: write to the pipeline's own output folder, publish via a copy script (both restructure the same Output-stage writing logic; doing 22 first avoids redoing that work twice).

**Status:** done

- [x] Output writes `wars.json` and `discoveries.json` as two separate files into `data/output/` (ticket 22's location), published via the same `publish-data` copy script.
- [x] Transform no longer merges the two lanes: `transformEvents()` split into `transformWars()`/`transformDiscoveries()`, each loading its own raw snapshot and scoring independently.
- [x] Verified end to end (not just reasoned about): ran the old single-file code and the new two-file code against the identical raw inputs and diffed the results. 701 entries in old `events.json`, 701 in the union of new `wars.json`+`discoveries.json`, exact ID-set match, zero overlap between the two new files, zero content mismatches on any field.
- [x] `write-datasets.test.ts` itself needed no changes — `buildEvents` has no lane-specific logic (it's called twice with different inputs, unchanged itself). Instead added `tag-events.test.ts`, asserting the invariant that makes the split provably safe: `tagHistoricalEvent` can never produce the `"invention"` category and `tagInvention` always does, so the two lanes' categories can never overlap by construction.

**Found during code review, fixed in the same unit:** `packages/shared-types/src/index.ts`'s `HistoricalEvent` comment still said "both sources merge into one events.json" — corrected. Also flagged (not fixed here, deliberately deferred per earlier discussion): `packages/web`'s `App.tsx` still imports `events.json` directly and will break once this is published — recorded as a tracked Open Question in `CLAUDE-activeContext.md` rather than left as a silent gap.
