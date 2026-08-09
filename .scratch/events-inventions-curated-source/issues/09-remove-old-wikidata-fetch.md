# 09 — Remove the old Wikidata P575 candidate fetch

Type: task
Status: resolved
Blocked by: 08

## Question

Once the curated source is live and verified (ticket "08 — Regenerate, publish, and verify discoveries.json end to end"), remove the superseded code and data:

- `packages/data-pipeline/src/fetch/queries/inventions.ts` (old P575/sitelinks candidate query) — unless ticket "02 — Fetch: batched per-QID enrichment pass for curated events" already repurposed/replaced this file, in which case confirm nothing else references the old query shape.
- `packages/data-pipeline/data/raw/events-inventions.raw.json` (~170K lines, the old raw SPARQL dump) — delete, no longer produced or consumed.
- Any now-dead constants/config solely used by the old candidate query (e.g. check `min-sitelinks.ts`'s `MIN_SITELINKS` usage elsewhere before removing).
- Update `packages/data-pipeline/CLAUDE.md`/docs and `docs/active-context.md` to describe Discoveries as curated-list-plus-enrichment sourced, not Wikidata-SPARQL-candidate sourced (the doc currently says "Wars & Conflicts and Discoveries & Inventions stay Wikidata SPARQL-sourced" — no longer accurate for Discoveries).

## Answer

Ticket 02 built a new file (`fetch-events-enrichment.ts`) rather than repurposing `inventions.ts`, so it was genuinely dead — deleted it and `inventions.test.ts`. Deleted `data/raw/events-inventions.raw.json`. `MIN_SITELINKS` (`min-sitelinks.ts`) stays — still used by `historical-events.ts` (Wars). `fetch-events.ts` renamed to `fetch-historical-events.ts` (`fetchEvents` → `fetchHistoricalEvents`) since it now only fetches Wars' historical-events candidate scan, not both lanes as its old name implied; `fetch/index.ts` updated to match. Updated `packages/data-pipeline/CLAUDE.md` (overview line, Stack table, Data Pipeline's Fetch/Score/Tag steps) to describe Discoveries as curated-list-plus-enrichment sourced. `docs/active-context.md` updated separately as part of this map's closing entry.
