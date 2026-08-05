# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. `packages/web` typechecks and renders all three lanes (People, Wars & Conflicts, Events & Inventions) with real published data — see Next Up for remaining priority ordering (Unit 5 vs. Unit 9).

## Completed

- Monorepo restructure: pipeline, shared-types, and frontend under `packages/*` as npm workspaces.
- Units 1–4: data pipeline scaffold (Fetch/Score/Tag/Output stages, `packages/shared-types`), frontend scaffold (`packages/web`, Vite + React 19 + TS, mini-FSD, Steiger boundaries), independently-scrolling synced `vis-timeline` lanes.
- Wars & Conflicts lane added: ranges/points, battle/treaty→war membership, ruler reign-period overlays (`Person.reignPeriods`).
- Fame Tier Redesign: sitelink/HPI floors replaced top-N fame-tier ceilings, applied across all three lanes; later split per-lane (`FAME_TIER_MIN_SITELINKS_WARS`/`_DISCOVERIES`) to balance dataset sizes. (Spec lived at `context/specs/06-fame-tier-redesign.md`, since removed along with the rest of that directory — the project now specs new work under `.scratch/<feature-slug>/`, see `docs/agents/issue-tracker.md`.)
- Output stage writes to a pipeline-owned `data/output/`, published to `packages/shared-types` via `npm run publish-data` (ticket 22).
- People lane migrated from Wikidata to Pantheon 2.0 (ticket 17), with descriptions via secondary Wikidata lookups and a CC BY-SA 4.0 data-license notice; reign-period enrichment rewired onto Pantheon's retained `wd_id` (ticket 19).
- Wikidata reliability fixes (retry on 502/503/504, era-bucketed fetch with per-bucket try/catch) for Discoveries & Inventions (ticket 20) and Wars & Conflicts (ticket 25); both lanes live re-fetched and published (`discoveries.json`, `wars.json`).
- Wars/Discoveries frontend rendering restored against the new `War`/`Discovery` types (`map-to-items.ts`, `App.tsx`).
- Reign-period query fixes: restricted to genuine Head-of-State/Government positions and excluded "emeritus" titles by label; `ReignPeriod.title` threaded through to frontend tooltips.
- `.scratch/alt-data-sources/` map closed — all fetch-stage source decisions (tickets 17–25) implemented; see the map and its `issues/`/`research/` subdirectories for the full decision trail.
- Removed the stale, pre-split `packages/shared-types/src/data/events.json`, fully superseded by `wars.json`+`discoveries.json`.
- `.scratch/timeline-rendering-foundation/` map closed — the vis-timeline-vs-D3 question that paused Unit 5's grilling session (below) is decided: **D3**, for all three lanes, via a real People-lane prototype (`/prototype`) compared side-by-side against vis-timeline, then `/grilling` + `/domain-modeling` to record `packages/web/docs/adr/0001-d3-over-vis-timeline.md`. Migration execution is a new, separate, not-yet-specced follow-on effort — see Next Up.

## In Progress

- None.

## Next Up

- Unit 9 (unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`).
- D3 migration, spec'd: `.scratch/d3-timeline-migration/spec.md` + `issues/01`–`06` — port `options.ts`/`map-to-items.ts`/`TimelineCanvas.tsx` off vis-timeline lane by lane, collapse the three-synced-instances architecture into one shared-horizontal-scroll container (see ADR 0001's Consequences), implement zoom (deferred by the ADR, unresolved), wire real design tokens once Unit 5 lands them (ticket 05), remove `vis-timeline` from `packages/web/package.json` (ticket 06). Not yet started.
- Unit 5: apply visual design tokens to the three-lane timeline, now targeting the D3 implementation rather than vis-timeline — see `packages/web/docs/design-tokens.md`; folded into `d3-timeline-migration` ticket 05 rather than its own spec. Pre-resolved inputs from the paused grilling session, still valid: new Occupation Domain Palette (already in `design-tokens.md`, independent of the existing Category palette — `Category` and `OccupationDomain` are separate enums by design, see `CONTEXT.md`); reign-period overlay as a solid stripe along the lifespan bar's bottom edge rather than a dashed border (color tentatively `color-accent-selected`, not yet its own decoupled token); lifespan bar height cut to 16px with the person's name kept inside.

## Open Questions

- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision. Wikidata-specific, unaffected by the People/Pantheon switch.
- `historical-events.ts`'s `EVENT_TYPES` list misses some historically-significant items typed under a more specific Wikidata subclass than the 8 listed classes — confirmed World War II and the Thirty Years' War are absent from `wars.json` for this reason (pre-existing, not a ticket-20 regression; e.g. WWII is likely typed as "world war" Q103495, not plain "war" Q198). Needs a Tag-stage/query-completeness decision, not a reliability fix.
- `Person.reignPeriods` overlays only have a neutral dashed border today — Unit 5 should give them real, pixel-inset styling.
- The Pantheon license decision (`.scratch/alt-data-sources/issues/10-pantheon-license-sharealike.md`) called for a `LICENSE-DATA.md` notice *and* an in-app attribution credit. Only the file notice exists — `packages/web` has no attribution UI. Needs a `packages/web` grilling session on placement/wording; deliberately left open when the `alt-data-sources` map closed rather than reopening it there.

## Session Notes

- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` — Pantheon (CSV download → HPI-filtered description batch → HPI-filtered reigns batch) → Wikidata events, in that order.
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into the pipeline's own `data/output/`), then `npm run publish-data` to copy into `../shared-types/src/data/` (verify via `git status packages/shared-types` that only the expected files changed).
- `packages/shared-types/src/data/people.json`, `discoveries.json`, and `wars.json` are all live/published now (Pantheon ticket 17; discoveries ticket 20; wars ticket 25). The full `npm run publish-data` script is safe to run again for any future re-fetch.
- `npm install` must run from the repo root (single lockfile there).
- To extend the Wars/Discoveries region lookup table: `npx tsx src/transform/list-unmapped-countries.ts` from `packages/data-pipeline/` (People's tables are Pantheon-value-keyed and fully enumerated — no maintenance script needed).
