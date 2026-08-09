# 19 — People: reign-period secondary enrichment

**What to build:** Ruler/office-holder reign-period overlays keep working after the People switch to Pantheon, sourced via a secondary Wikidata lookup keyed on the Wikidata Q-ID Pantheon retains per person.

**Blocked by:** 17 — People: switch to Pantheon (needs the downloaded Pantheon raw rows and their `wd_id` values to exist).

**Status:** done

- [x] The existing batched Q-ID reigns query runs against the list of `wd_id` values from the downloaded Pantheon raw rows, not a primary Wikidata people scan. Filtered to `MIN_HPI` (mirroring `fetch-descriptions.ts`) rather than the full 126k-row Pantheon corpus — anything below that floor never survives Score, so querying it would be wasted, same reasoning `MIN_HPI`'s own comment already gives for descriptions.
- [x] `fetchReigns()` re-wired into `fetch/index.ts`'s orchestration (after `fetchPantheon()`, alongside `fetchDescriptions()`).
- [x] Regenerating `people.json` still populates `reignPeriods` for known rulers/office-holders — verified live, not just reasoned about: ran the batched SPARQL reigns query against real Wikidata (5,554 rows across 77 batches), rebuilt `people.json`, and spot-checked Louis XIV (1643–1715), Queen Victoria (1837–1901), and Napoleon's terms by hand — all correct. Coverage rose from 638 to 1,752 of 3,680 people with `reignPeriods` populated (previously built from a frozen pre-Pantheon snapshot that only coincidentally overlapped on well-known Q-IDs).
- [x] No structural change to the existing reigns query/batching mechanism itself — only its input Q-ID source changes. `buildReignsQuery`/`batchedSparqlFetch`/`groupReigns` untouched.
- [x] Published the updated `people.json` alone to `packages/shared-types` (not the full `publish-data` script, since `data/output/wars.json`/`discoveries.json` are still pending tickets 20/25 and aren't ready to publish yet).
