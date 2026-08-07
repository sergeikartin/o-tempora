# Map: Events & Inventions lane — switch to curated source

Labels: wayfinder:map

## Destination

Replace the Events & Inventions (Discoveries) lane's Wikidata-SPARQL-sourced Fetch (`packages/data-pipeline/src/fetch/queries/inventions.ts`, P575-only, no real classification signal — produces junk like "Brazil"/"Antarctica" as top entries) with the hand-curated 121-event list already committed at `packages/data-pipeline/data/raw/events-curated.raw.json`.

This map **decides and executes** the swap directly (mirroring how `alt-data-sources` closed), not a handoff spec. It closes when `discoveries.json` is regenerated from the curated source and published to `packages/shared-types`, end to end through the app.

## Notes

- Domain: `packages/data-pipeline` (Fetch/Score/Tag/Output stages for the Discoveries lane) and `packages/web` (`EventsLane.tsx`, `CATEGORY_COLORS`, sidebar fame-filter bounds).
- Skills: `/prototype` for the color-palette ticket; `/grilling` + `/domain-modeling` for any ticket that turns up a real open decision. Most remaining tickets are execution (`task` type) — the decisions were resolved during charting, below.
- Standing decisions, settled during destination-grilling (2026-08-07):
  - **Fetch architecture**: the curated file is ground truth for `name`/`year`/`category`. A new batched per-QID Wikidata SPARQL enrichment pass — mirroring the existing Pantheon/People pattern (CSV + batched QID-keyed SPARQL enrichment) — backfills `sitelinks` (→ `fameScore`), `wikipediaUrl`, and `country` (→ `regionTags`).
  - **Category taxonomy split**: `Category` (`packages/shared-types/src/index.ts`) stays as Wars & Conflicts' type, with `"invention"` removed. A new `DiscoveryCategory` (10 values, taken verbatim from `events-curated.raw.json`'s `meta.categories`) is introduced for Discoveries. Wars & Conflicts is otherwise untouched by this map.
  - **Scale is frozen**: 121 curated events is the candidate set for this map. Growing the curated list further is out of scope (see below).
  - **`dateProperty` is discarded** before pipeline ingestion — it's curation-time provenance (which of 10 Wikidata properties supplied each event's date), no runtime meaning once `year` is curator-verified.
  - **fameScore filter stays** for Discoveries, but `FAME_SCORE_BOUNDS.discoveries` (`packages/web/src/shared/config/viewport.ts`) must be recalibrated to the curated set's real post-enrichment sitelink range — the current bounds (`min:50, max:386, default:200`) reflect the old 806-item Wikidata corpus, not this one.
  - **Enrichment-failure handling**: if the SPARQL pass can't resolve `sitelinks`/`wikipediaUrl` for a curated QID, drop that row — same as today's `validateEventRow` behavior. "121" is an upper bound on the published count, not a guarantee.
  - `regionTags` may legitimately be empty for curated events with no natural `country` claim (e.g. "General relativity", "Electromagnetic induction") — `buildDiscoveries` doesn't currently require it non-empty, so no schema change needed there.
- Current-state facts gathered while charting (2026-08-07): `Category` enum is 8 values (`science, politics, art, philosophy, war, invention, exploration, religion`), shared by `War` and `Discovery`; `tagInvention` (`transform/tag-events.ts`) unconditionally returns `"invention"` today — no real lookup. `Discovery` extends `TimelineEntry` (`fameScore` required) plus `category`/`regionTags`. `EventsLane.tsx` renders every entry as a single-year point (never a range bar), colored via `CATEGORY_COLORS[item.category]`, shared with `WarsLane.tsx`. The old raw dump `events-inventions.raw.json` is ~170K lines / 6,107 bindings; curated file is 121 events, category distribution: everyday-technology 27, transportation 22, communication 19, energy-industry 17, medicine-health 12, science-theory 8, food-agriculture 5, exploration 5, infrastructure 4, society-administration 2.

## Decisions so far

- **Closed (2026-08-07)** — all 9 tickets resolved via `/implement`, in dependency order (01 → 02/03 → 04 → 05/06 → 07 → 08 → 09). Destination reached: `discoveries.json` is live from the curated + enriched source, published, and verified end-to-end in a real running app.
- Ticket 01: color palette locked with the user (balanced-pastel variant) — see the ticket's own Answer for the 10 hex values.
- Ticket 02/04: new Fetch step (`fetch-events-enrichment.ts`) + Transform rewrite (`transformDiscoveries` reads the enriched file directly, no `groupRows`). Decided to drop the pipeline-internal specialist-floor filter for Discoveries entirely (`rankDiscoveriesBySitelinks`, sort-only) — the sidebar's user-facing floor is the only density control now, consistent with ADR 0003.
- Ticket 03: `DiscoveryCategory` (10 values) split from Wars' `Category` (now 7, `invention` removed) in `packages/shared-types`.
- Ticket 05: `FAME_SCORE_BOUNDS.discoveries` recalibrated to `{ min: 8, max: 296, default: 25 }` from the real published sitelink range (n=121).
- Ticket 09: old `inventions.ts`/`events-inventions.raw.json` deleted; `fetch-events.ts` renamed `fetch-historical-events.ts` since it's Wars-only now.
- Live run against Wikidata: 121/121 curated QIDs enriched successfully, 0 rows dropped at Output.

## Not yet specified

<!-- empty — destination-grilling resolved the open decisions directly (see Notes); remaining work is execution, already ticketed -->

## Out of scope

- Growing the curated list beyond its current 121 events — future, separate curation effort.
- Any change to Wars & Conflicts beyond removing `"invention"` from the shared `Category` enum it keeps.
- Redesigning progressive/fame-tier-first data loading — a separate, already-flagged effort tracked on the `sidebar-filters-legend` map's Out of scope / `docs/active-context.md`.
