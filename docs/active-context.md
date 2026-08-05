# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. `packages/web` typechecks and renders all three lanes (People, Wars & Conflicts, Events & Inventions) with real published data, now on D3 — see Next Up for remaining priority ordering (ticket 05 vs. Unit 9).

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
- D3 timeline migration (`.scratch/d3-timeline-migration/`, tickets 01–04 + 06; ticket 05 still open, see Next Up) landed: `TimelineCanvas.tsx` is now one shared-horizontal-scroll container holding `PeopleLane`/`WarsLane`/`EventsLane` (new files) stacked vertically, each with its own independent `overflow-y` region — the native scroll position on that one container *is* the cross-lane time-axis sync, replacing the old three-`Timeline`-instances-plus-`rangechange`-listener-plus-reentrancy-guard design entirely. `options.ts` now holds the shared `xScale`/pixels-per-year zoom math (bounded by the existing `ZOOM_MIN_YEARS`/`ZOOM_MAX_YEARS`) and provisional inlined `DOMAIN_COLORS`/`CATEGORY_COLORS`; `map-to-items.ts` is pure `Person`/`War`/`Discovery` → render-item mapping plus the shared `assignRows` greedy interval-graph row-stacking function (used by People and Wars & Conflicts; Events & Inventions is points-only, single row). Years are plain numbers end-to-end now — `shared/lib/dates.ts` dropped `toLegacyDate`/`yearToPlainDate` (nothing needs a legacy `Date` anymore) and keeps only `today()`. `vis-timeline` is removed from `packages/web/package.json`; `d3` added. Zoom's center-preserving re-pan (recenters on the year at the viewport's middle before a +/- click) is new behavior, not a port. Docs updated: `packages/web/docs/code-conventions.md`'s Timeline Rendering section, `packages/web/CLAUDE.md`'s Stack table + description line.

## In Progress

- None.

## Next Up

- Unit 9 (unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`).
- Unit 5 / D3 migration ticket 05 (`.scratch/d3-timeline-migration/issues/05-real-design-tokens.md`, blocked on Unit 5's still-open decisions below): replace the D3 rendering core's provisional inlined colors (`DOMAIN_COLORS`/`CATEGORY_COLORS`/`REIGN_STRIPE_COLOR` in `packages/web/src/widgets/timeline-canvas/options.ts`) with real CSS custom properties once `packages/web/docs/design-tokens.md`'s palette is wired as tokens; also resolve the reign-period marker's real token (tentatively `color-accent-selected`, not yet decoupled into its own `color-marker-reign-period` token) and the lifespan-bar name-label font-size/padding at the finalized 16px bar height.

## Open Questions

- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision. Wikidata-specific, unaffected by the People/Pantheon switch.
- `historical-events.ts`'s `EVENT_TYPES` list misses some historically-significant items typed under a more specific Wikidata subclass than the 8 listed classes — confirmed World War II and the Thirty Years' War are absent from `wars.json` for this reason (pre-existing, not a ticket-20 regression; e.g. WWII is likely typed as "world war" Q103495, not plain "war" Q198). Needs a Tag-stage/query-completeness decision, not a reliability fix.
- `Person.reignPeriods` overlays now render as a solid bottom-edge stripe (D3 migration ticket 01, `REIGN_STRIPE_COLOR` in `options.ts`) but the color is still a provisional inlined hex, not a real token — ticket 05 above.
- The Pantheon license decision (`.scratch/alt-data-sources/issues/10-pantheon-license-sharealike.md`) called for a `LICENSE-DATA.md` notice *and* an in-app attribution credit. Only the file notice exists — `packages/web` has no attribution UI. Needs a `packages/web` grilling session on placement/wording; deliberately left open when the `alt-data-sources` map closed rather than reopening it there.

## Session Notes

- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` — Pantheon (CSV download → HPI-filtered description batch → HPI-filtered reigns batch) → Wikidata events, in that order.
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into the pipeline's own `data/output/`), then `npm run publish-data` to copy into `../shared-types/src/data/` (verify via `git status packages/shared-types` that only the expected files changed).
- `packages/shared-types/src/data/people.json`, `discoveries.json`, and `wars.json` are all live/published now (Pantheon ticket 17; discoveries ticket 20; wars ticket 25). The full `npm run publish-data` script is safe to run again for any future re-fetch.
- `npm install` must run from the repo root (single lockfile there).
- To extend the Wars/Discoveries region lookup table: `npx tsx src/transform/list-unmapped-countries.ts` from `packages/data-pipeline/` (People's tables are Pantheon-value-keyed and fully enumerated — no maintenance script needed).
