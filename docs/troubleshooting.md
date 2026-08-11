# Troubleshooting

<!-- Known issues and proven solutions. Empty until the first real issue is logged here — do not pre-populate with speculative content. Root-caused, non-obvious bugs and their fixes belong here; day-to-day implementation history lives in git log. -->

## A war's start date is wrong / earlier than expected (e.g. shows a date decades or centuries off)

**Symptom:** a `War`'s `period.start.year` in `wars.json` doesn't match its own `description` field, or is later than its `period.end.year`.

**Root cause:** `wars-enrichment.ts`'s SPARQL query resolves `?date` from Wikidata via `COALESCE(?startTime, ?pointInTime)` — P580 (start time) preferred, P585 (point in time) as fallback. Before this was fixed, the COALESCE order was reversed (P585 preferred over P580). Because Wars & Conflicts entries already carry an explicit start/end range, an item's P585 is often unrelated or much coarser-precision than its real P580 start date, so preferring it silently produced wrong start years — e.g. Wars of the Roses resolved to `1500` (P585, century precision) instead of `1455` (P580, day precision); the American Civil War resolved to `1865` (its own *end* year) instead of `1861`.

**Fix:** prefer `?startTime` over `?pointInTime` in the COALESCE (and the matching precision COALESCE), then re-run just the Wars lane — `npm run fetch --workspace packages/data-pipeline -- --lane=wars` — from the repo root (or, for a narrower re-run of only this one enrichment stage, `npx tsx src/fetch/fetch-wars-enrichment.ts` from `packages/data-pipeline`), followed by `npm run build-data` and `npm run publish-data`. See `packages/data-pipeline/src/fetch/queries/wars-enrichment.ts` and ADR `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.

**If it recurs:** re-running the enrichment fetch pulls live Wikidata data, so a newly-added curated war could surface the same P580-vs-P585 mismatch pattern again if a future edit reintroduces a COALESCE preferring P585 first. Spot-check any new war's resolved `year` against its `description` text before publishing.
