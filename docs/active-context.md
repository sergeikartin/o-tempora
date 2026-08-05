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
- Fame Tier Redesign (`context/specs/06-fame-tier-redesign.md`): sitelink/HPI floors replaced top-N fame-tier ceilings, applied across all three lanes; later split per-lane (`FAME_TIER_MIN_SITELINKS_WARS`/`_DISCOVERIES`) to balance dataset sizes.
- Output stage writes to a pipeline-owned `data/output/`, published to `packages/shared-types` via `npm run publish-data` (ticket 22).
- People lane migrated from Wikidata to Pantheon 2.0 (ticket 17), with descriptions via secondary Wikidata lookups and a CC BY-SA 4.0 data-license notice; reign-period enrichment rewired onto Pantheon's retained `wd_id` (ticket 19).
- Wikidata reliability fixes (retry on 502/503/504, era-bucketed fetch with per-bucket try/catch) for Discoveries & Inventions (ticket 20) and Wars & Conflicts (ticket 25); both lanes live re-fetched and published (`discoveries.json`, `wars.json`).
- Wars/Discoveries frontend rendering restored against the new `War`/`Discovery` types (`map-to-items.ts`, `App.tsx`).
- Reign-period query fixes: restricted to genuine Head-of-State/Government positions and excluded "emeritus" titles by label; `ReignPeriod.title` threaded through to frontend tooltips.
- `.scratch/alt-data-sources/` map closed — all fetch-stage source decisions (tickets 17–25) implemented; see the map and its `issues/`/`research/` subdirectories for the full decision trail.
- Removed the stale, pre-split `packages/shared-types/src/data/events.json`, fully superseded by `wars.json`+`discoveries.json`.

## In Progress

- Unit 5 grilling session (People-lane lifespan rendering), paused mid-session to question the underlying vis-timeline rendering approach before finalizing a spec. Resolved so far:
  - New Occupation Domain Palette (`packages/web/docs/design-tokens.md`), independent of the existing Category palette — `Category` (Wikidata, Wars & Conflicts/Events & Inventions) and `OccupationDomain` (Pantheon, People) are separate enums by design; see `CONTEXT.md`.
  - Reign-period overlay: moving off the neutral dashed border to a solid fixed-color marker — a thin stripe along the *bottom* edge of the lifespan bar (not full-height inset), `radius-sm`, tentatively its own token (`color-marker-reign-period`, same hex as `color-accent-selected` but decoupled — not yet explicitly confirmed).
  - Lifespan bar height cut to 16px with the person's name kept inside (not moved out) — implies smaller name-label type; exact font-size/padding not yet decided.
  - Flagged risk: vis-timeline reserves stacking row-height based on its own default item height, not CSS overrides — shrinking to 16px via CSS may leave gaps between stacked People rows unless addressed.

## Next Up

- Unit 9 (unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`).
- Unit 5: apply visual design tokens to the three-lane timeline — see `context/specs/00-build-plan.md` and `packages/web/docs/design-tokens.md`. Not yet spec'd.

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
