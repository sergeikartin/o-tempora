# 06 — Live pipeline run, publish, and verify end to end

Type: task
Status: resolved
Blocked by: 02, 03, 04, 05

## Question

Run the full pipeline against the real hand-off list, end to end:

1. `npm run fetch --workspace packages/data-pipeline` — bootstrap (ticket 05, run once) then live enrichment (ticket 02) against every curated QID.
2. `npm run build-data --workspace packages/data-pipeline` — Score/Tag/Output (ticket 03).
3. `npm run publish-data --workspace packages/data-pipeline` — copy into `packages/shared-types`.

Verify, not just "it ran without throwing":

- Every curated QID either resolved or shows up in the `DropReport` with a sensible reason — spot-check a few drops by hand against Wikidata to confirm they're genuine (stale/redirected QID, no date claim at all), not a query bug.
- Spot-check a handful of entries across categories for correct `description`, `image`, `regionTags`, and date precision (year-only vs. month, matching what Wikidata actually claims).
- Confirm at least one real Container/nesting chain survives into the output (e.g. an umbrella conflict with a `parentId`-linked child), proving `parentId` works end to end — per the spec's decision that this pass shouldn't need artificial examples.
- Confirm the shape split looks right: entries with a genuine Wikidata start+end became `War`s, single-date entries became `WarEvent`s, independent of `category`.
- `npm run test --workspace packages/data-pipeline` and `npm run typecheck --workspace packages/data-pipeline` both clean.

## Answer

**Major finding, not anticipated by the spec**: the first live enrichment run showed 74/156 curated wars (47%) resolving no date at all — including the Napoleonic Wars, Russian Civil War, and other extremely well-known conflicts. Investigating one (Napoleonic Wars, curated as `Q8310`) directly against Wikidata's raw claims showed `Q8310` is actually a village in Finland, not the Napoleonic Wars — the curated list's `id`s were wrong, not missing Wikidata coverage. Cross-checking every curated QID's Wikidata label against its curated name found **80 of 156 (51%) pointed to unrelated Wikidata items** (villages, insects, cars, board games) — almost certainly from a flawed automated QID-resolution step in whatever process produced the original hand-off file.

Resolved via Wikidata's `wbsearchentities` API plus cross-referencing each mismatch's *original* year/description (from the richer file the user first handed off, before it was reduced to `id`/`name`/`category` per this spec's decision) as a disambiguation signal against multiple same-named Wikidata items: **78 of 80 got a confirmed correct replacement QID**, applied directly to `wars-curated.raw.json` (with 7 `parentId` references remapped to match). Two had no clean single-item mapping and were dropped per user direction: "Baltic War of Liberation" (actually three separate national wars — Estonian/Latvian/Lithuanian — with no combined Wikidata item) and "Pig War" (the curated entry meant the 1906–1909 Serbia/Austria-Hungary tariff war; the only "Pig War" on Wikidata is the unrelated 1859 US/Britain San Juan Island dispute). One of the 78 corrections (`Rohilla War`) initially resolved to a Wikimedia disambiguation page rather than a real item, caught by the still-nonzero missing-date count on re-run and fixed to the specific `Q5453768` "First Rohilla War".

Post-correction, the curated list (154 rows) enriched cleanly: 152/154 resolved a date (only 2 genuine Wikidata gaps remain — `Moro Wars`/`Q11883242` and `Arab-Israeli wars`/`Q3491398`, both correct items that simply lack `P580`/`P582`/`P585` claims), 0 sitelinks/description/wikipediaUrl failures, 142/154 got an image. `npm run build-data` kept 145/154 (9 dropped: 2 missing date, 4 `parentId not found` — cascading from `Arab-Israeli wars` (`Q3491398`) itself being dropped, orphaning its 4 children — and 3 `parentId is not a War` — `Russian Revolution` (`Q8729`) has only a Wikidata point-in-time claim despite its own description text reading "1917-1922", so it resolves as a `WarEvent` and can't parent its 3 children). This last case is the enrichment-driven shape rule working exactly as designed, not a bug — flagged to the user as a known trade-off, not fixed by hand (no manual-override mechanism exists in this pipeline, per `CLAUDE.md`).

Verified in the published `wars.json`: 145 entries, 136 `War`/9 `WarEvent` (shape correctly independent of `category` — 6 categories represented), 16 surviving 2-level `parentId` chains (e.g. `French and Indian War` → `Seven Years' War`, `Peninsular War` → `Napoleonic Wars` — the corrected QID `Q78994` in active use), spot-checked `French Revolution` for correct month-precision dates/description/image. `packages/web` typecheck (110 tests), test suite, and production build all pass clean against the new dataset. regionTags coverage is uneven (87/145 have none — `wdt:P17` is frequently absent for umbrella conflicts on Wikidata) but this matches the old pipeline's existing best-effort behavior, not a regression.
