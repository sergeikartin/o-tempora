# 18 — Output: split into wars.json/discoveries.json

**What to build:** The pipeline's Output stage stops merging Wars & Conflicts and Discoveries & Inventions into one `events.json` and instead writes two independent files. This restructures only how today's existing Wikidata-sourced data is written — no new external data source is involved yet.

**Blocked by:** 22 — Output: write to the pipeline's own output folder, publish via a copy script (both restructure the same Output-stage writing logic; doing 22 first avoids redoing that work twice).

**Status:** ready-for-agent

- [ ] Output writes `wars.json` (Wars & Conflicts entries) and `discoveries.json` (Discoveries & Inventions entries, renamed from `events.json`) as two separate files into the pipeline-owned output location established by ticket 22, published to `packages/shared-types` via the same copy script.
- [ ] The Transform stage no longer merges the two lanes at any point; each lane's raw snapshot flows through Score/Tag/Output independently.
- [ ] Regenerating from the current (unchanged) Wikidata raw snapshots produces `wars.json` and `discoveries.json` whose union is equivalent to today's single `events.json` (same entries, same fields) — no data lost or duplicated in the split.
- [ ] `write-datasets.test.ts`-style tests cover the two-file output.
