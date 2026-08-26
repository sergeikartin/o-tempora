---
status: accepted
---

# Source `name` from Wikidata's `rdfs:label` (English + Russian) instead of curator text or Pantheon's CSV, and add `ru.wikipedia.org` as a second live Wikipedia dependency

Shipping a Russian build (`.scratch/russian-localization/spec.md`) required every entity-content field — `name`, `tagline`, `description` — to resolve symmetrically in English and Russian, with per-field English fallback baked in by the pipeline. `tagline`/`description` already had a live-fetch mechanism to extend; `name` did not, and its three lanes each sourced it differently:

- **Conflicts/Milestones**: curator-typed, hand-authored once in the curated raw JSON (`conflicts-curated.raw.json`/`milestones-curated.raw.json`), never refetched.
- **People**: Pantheon 2.0's own CSV `name` column — a frozen snapshot as of Pantheon's last dataset export.

Neither source has a Russian equivalent. Both are replaced with Wikidata's own `rdfs:label`, fetched in both `en` and `ru`, via the same batched per-QID SPARQL enrichment pass each lane already runs for `tagline`/sitelinks/dates (`queries/conflicts-enrichment.ts`, `queries/milestones-enrichment.ts`, `queries/taglines.ts`) — no new request count, one more `OPTIONAL` binding per language on an existing query, the same treatment `tagline`'s own Russian binding got.

## Why Wikidata's label, not a translation of the curated/Pantheon text

The motivating case (see the spec): a literal translation of "French Revolution" loses the real Russian historiographical convention, "Великая французская революция" ("**Great** French Revolution"). Wikidata's own `ru` label carries that convention directly; a machine translation of the English string would not. Sourcing both languages from the same `rdfs:label` mechanism also means English and Russian names now share one consistent, symmetric origin — no per-entity editorial drift between a curator's English text and a translator's Russian text.

## Consequences

- **Conflicts/Milestones' curated `name` field is retired from the pipeline's read path**, but left on disk in the curated raw JSON files, unused rather than deleted — same "kept as historical record" precedent `0011`'s Discoveries-`Tagline` change already established for the old curated text it superseded. `category`/`parentId` (Conflicts) and `category` (Milestones) are still curator-authored; only `name` moved.
- **People's `name` now depends on the same HPI-floored candidate set `tagline` already uses** (`MIN_HPI`, `fetch-taglines.ts`) rather than being present unconditionally the way Pantheon's CSV column was. In practice this changes nothing observable: every person who survives to Output already needs a resolvable `tagline` (drop reason `"missing tagline"`), so a resolvable `name` was already a precondition in every case that matters; a missing `name` now drops the row under its own `"missing name"` reason instead of silently keeping Pantheon's stale text.
- **Names now reflect Wikidata's current state, not Pantheon's snapshot date.** A title/status change since Pantheon's last export now surfaces on the next fetch — e.g. "Charles, Prince of Wales" (Pantheon) vs. "Charles III" (Wikidata, current), confirmed via a 12-entry spot check against the top-200-by-fame sample (11/12 exact matches; the one mismatch was exactly this case). Accepted as correct behavior, not a regression: Wikidata's label is definitionally the more current source.
- **`EnrichedConflict.name`/`EnrichedMilestone.name`/People's enrichment-sourced `name` are all now optional** (`string | undefined`), not guaranteed-present the way curator text or Pantheon's CSV column were — Output (`write-datasets.ts`) drops a row with no resolvable English name, the same "no fallback, drop instead" rule `tagline` already followed.
- **No curator-override mechanism for the auto-fetched name** (e.g. a hand-correction field) — deliberately out of scope per the spec, revisited only if real-world drift from this switch turns out to bite.

## A second live dependency: `ru.wikipedia.org`

`description` (Wikipedia's lead-paragraph `extract`, `0011`) has no Wikidata equivalent at all — it can only come from actual Wikipedia article prose. Sourcing a Russian `description` therefore means querying `ru.wikipedia.org`'s own REST summary API, not just adding a language parameter to a SPARQL query. `wikipedia-client.ts`'s previously-hardcoded `en.wikipedia.org` `ENDPOINT` constant becomes `endpoint(lang)`, and `fetchWikipediaSummary`/`batchedWikipediaExtractFetch` both take a `lang: 'en' | 'ru' = 'en'` parameter threaded through unchanged otherwise (same retry/backoff/pacing behavior, just pointed at a different host). `fetch-wikipedia-extracts.ts` runs the Russian pass as a second, sequential sweep per lane (`runExtractPass`, `<lane>-wikipedia-extracts.ru.raw.json`, sibling to the existing English `<lane>-wikipedia-extracts.raw.json`) — roughly doubling this stage's wall-clock time (already the pipeline's slowest stage, `0011`'s ~35 min observed), accepted for the same "one-time cost of an on-demand, never-scheduled pipeline" reason `0011`/`0010` already established.

Materially lower Russian coverage than English is expected here — not every English Wikipedia article has a Russian counterpart — which is exactly what per-field English fallback (baked in at Output, `write-datasets.ts`'s `resolveOptionalField`) exists to absorb; see `CONTEXT.md`'s **Field Fallback** entry.

People's Russian article title (needed to query `ru.wikipedia.org`) has no CSV-column equivalent to Pantheon's English `slug` — People never fetched a per-language sitelink URL the way Conflicts/Milestones do (their enrichment queries already cover the full pageviews-basket language set, "ru" included, via `articleUrls`). `queries/taglines.ts` gains an `?articleRu` binding (the same `schema:about`/`schema:isPartOf` pattern) for this one purpose; `fetch-wikipedia-extracts.ts`'s `loadPeopleEntriesRu` reads it back out of `fetch-taglines.ts`'s raw SPARQL output, the only lane that needs this extra step.
