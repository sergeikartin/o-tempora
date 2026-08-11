# 02 — Discoveries: live-fetch `tagline` instead of curated text

**What to build:** Events & Inventions (Discoveries) currently ships a hand-curated, never-refetched tagline. Change it to be live-fetched from Wikidata for every curated entity, the same mechanism People and Wars already use — with no fallback to the old curated text. This brings all three lanes onto one consistent sourcing model for `tagline`, at the cost of a real behavior change: an entity whose live lookup fails to resolve a tagline is now dropped from the published output, something that could never happen for Discoveries before.

**Blocked by:** 01 — Rename `description` → `tagline` everywhere

**Status:** resolved

- [x] Discoveries' `tagline` is sourced from a live per-entity Wikidata lookup, not from the hand-curated text in the curated source list.
- [x] An entity whose live lookup can't resolve a tagline is dropped from the published Discoveries output — no fallback to the curated text, matching how People/Wars already behave when their live fetch fails.
- [x] The previously hand-curated tagline text remains untouched on disk in the curated source file — it's simply no longer read by the pipeline, not deleted.
- [x] Tests cover both the "live value wins" case and the "no live value resolved → entity dropped" case for Discoveries.

## Answer

`queries/events-enrichment.ts`'s SPARQL query gained an `OPTIONAL { ?event schema:description ?tagline . FILTER(LANG(?tagline) = "en") }` binding, the same shape `wars-enrichment.ts` already had. `fetch-events-enrichment.ts`: `CuratedEvent` no longer has a `tagline` field at all (with a comment warning against wiring it back in); `EnrichedEvent.tagline` is now optional and sourced from the enrichment binding (`entry.tagline`), not the curated file. `transform/index.ts`'s `TaggedDiscovery.tagline` became optional to match. Output's `validateEventRow`/`buildDiscoveries` already had generic "drop on missing tagline" logic from ticket 01 (Rename `description` → `tagline` everywhere) — no changes needed there.

The curated file's old hand-typed `tagline` text is untouched on disk (`events-curated.raw.json`), simply no longer parsed into `CuratedEvent`.

Ran the real live enrichment fetch (121 curated QIDs, one batched SPARQL pass, three batches) to regenerate `events-curated-enriched.raw.json` with genuinely live-fetched taglines rather than hand-transformed old text — all 121 resolved (0 drops in this dataset, though the drop path is real and now tested). Rebuilt and republished `discoveries.json` from that; several taglines changed wording versus the old curated text (e.g. "device for the analogue recording and playback of sound" vs. the previous curated phrasing), and a few images refreshed too as a side effect of re-running the same combined enrichment query live. `people.json`/`wars.json` were also rebuilt/republished as part of the same `build-data`/`publish-data` run — verified byte-for-byte semantically identical (only JSON key-order differs) to their post-ticket-01 state, so no unintended change there.

New tests: `write-datasets.test.ts`'s "buildDiscoveries drops a row whose live enrichment couldn't resolve a tagline" (the drop case) and `transform/index.test.ts`'s "transformDiscoveries passes through the enrichment file's live-fetched tagline" + "...leaves tagline undefined when the enrichment pass couldn't resolve one" (the live-value-wins / no-fallback cases), plus updated `events-enrichment.test.ts` coverage for the new SPARQL binding. Full `data-pipeline` suite: 151/151 passing; `web` typecheck and 125/125 tests unaffected (no web code touched by this ticket).
