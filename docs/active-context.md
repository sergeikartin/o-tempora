# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. `packages/web` typechecks and renders with real Pantheon People data. `wars.json`/`discoveries.json` are now both published to `packages/shared-types`, but `packages/web` still needs the frontend work to consume them — see Next Up for current priority ordering (Unit 5 vs. the wars/discoveries frontend gap).

## Completed

- Monorepo restructure: pipeline, shared-types, and frontend live under `packages/*` as npm workspaces.
- Unit 1: Data pipeline scaffold + Fetch stage (SPARQL client, Wikidata).
- Unit 2: Score, Tag, Output stages; added `packages/shared-types`.
- Unit 3: Frontend scaffold (`packages/web`) — Vite + React 19 + TypeScript, mini-FSD, Steiger boundaries.
- Unit 4: Two-lane (People/Events) `vis-timeline` canvas rendering real data, `Temporal.PlainDate` throughout.
- Post-Unit-4: reworked lanes into two independently-scrolling, synced `Timeline` instances.
- Wars & Conflicts frontend unit: third lane for wars/battles/treaties as ranges/points, reign-period overlays.
- Data-pipeline: added wars-as-ranges, battle/treaty→war membership, ruler reign periods (`Person.reignPeriods`).
- Data-pipeline bug fix: People lane was empty in the default 1800s view (unordered Fetch exhausted its page budget in antiquity); fixed via era-bucketed fetch, roughly doubling the usable dataset.
- Fame Tier Redesign (`context/specs/06-fame-tier-redesign.md`): replaced top-N fame-tier ceilings with sitelink/HPI floors (`FAME_TIER_MIN_SITELINKS`/`FAME_TIER_MIN_HPI`). Live re-fetch under the new thresholds is done for all three lanes: People (Pantheon switch, below), Discoveries & Inventions (ticket 20), Wars & Conflicts (ticket 25).
- Data-pipeline: output stage now writes to a pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types` as an explicit, separate step (ticket 22).
- Data-pipeline: People lane switched from Wikidata to Pantheon 2.0 (ticket 17, `.scratch/alt-data-sources/`) — new fetch/tag/score pipeline keyed on Pantheon's HPI and occupation/region tables; descriptions come from secondary Wikidata SPARQL lookups keyed on the retained QID. Reign-period rewiring onto Pantheon data landed separately (ticket 19, below). Published to `packages/shared-types` with a CC BY-SA 4.0 data-license notice.
- `packages/web`: propagated the Pantheon `Person` shape (ticket 17) into the frontend — `shared/types` now only exports `Person`; `mapWarsAndConflictsToItems`/`mapInventionsToItems` were removed (not adapted) since `wars.json`/`discoveries.json` aren't published yet, so those two lanes construct but render empty. Could not visually verify in a browser (no Playwright Chrome binary in this environment).
- Ticket 19 (People: reign-period secondary enrichment): `fetch-reigns.ts` now sources its candidate Q-ID list from `people-pantheon.raw.csv`'s `wd_id` column (HPI ≥ `MIN_HPI`, mirroring `fetch-descriptions.ts`) instead of the retired Wikidata `people.raw.json`, and is wired back into `fetch/index.ts`. Verified live (not just reasoned about): re-ran the batched SPARQL reigns query against real Wikidata (5,554 rows across 77 batches), rebuilt `people.json`, and spot-checked known monarchs (Louis XIV 1643–1715, Queen Victoria 1837–1901, Napoleon's terms) — all correct. Coverage rose from 638 to 1,752 of 3,680 people with `reignPeriods` populated. Published just the updated `people.json` to `packages/shared-types` (not the full `publish-data` script, since `data/output/wars.json`/`discoveries.json` are still pending tickets 20/25 and aren't ready to publish).
- Ticket 20 (Discoveries & Inventions: Wikidata reliability fixes, `.scratch/alt-data-sources/issues/20-discoveries-wikidata-reliability.md`): `wikidata-client.ts` now retries 502/503/504 with exponential backoff (alongside existing 429 handling) and its client-side timeout is raised 30s→55s. `fetch-events.ts` (fetches both the Wars/historical-events and Discoveries/inventions queries) now era-buckets both queries the same way the pre-Pantheon people fetcher did, each bucket independently try/catch-guarded — one bad bucket, or a whole query call failing, can no longer crash the Fetch run. Verified live: a full re-fetch completed with zero retries/failures across all 26 buckets for both queries (1,208 historical-event raw rows, 6,107 invention raw rows — pre-dedup; `build-data` groups these down to 771/3,102 unique entities); `wars.json` built clean (771/0 dropped) and was later published by ticket 25 (below); `discoveries.json` (3,102 kept) published alone to `packages/shared-types/src/data/discoveries.json` at the time. Also fixed a latent bug found along the way: `packages/data-pipeline`'s `npm test` script silently never ran test files living directly in a stage directory (only nested ones) because `/bin/sh` pre-expanded its `**` globs — quoting them in `package.json` fixed it and surfaced two previously-silent-but-passing test files.
- Ticket 25 (Wars & Conflicts: Wikidata reliability fixes and live re-fetch, `.scratch/alt-data-sources/issues/25-wars-wikidata-reliability.md`): no new code — ticket 20's `fetchEvents()` rewrite already covered the historical-events/Wars query call (try/catch + era-bucketing), since both queries share that function. This ticket was the live-verify-and-publish pass: confirmed full-history coverage (years -1456 to 2026, 442 entries inside the abandoned CDB90 1600-1973 window, no gap) and genuine type diversity in the raw (pre-dedup) row counts (war 313, battle 454, treaty 111, siege 92, revolution 49, rebellion 86, military operation 90, generic historical event 13 — all 8 `EVENT_TYPES` represented), reusing ticket 20's live fetch from the same session rather than re-hitting WDQS for identical data — no fetch execution happened under this ticket specifically, only verification of an already-fresh artifact plus the actual publish step. Ran `npm run publish-data` for real (not a manual copy) since `people.json`/`discoveries.json` were already consistent; `packages/shared-types/src/data/wars.json` (771 entries) is now published and byte-identical to the pipeline's own output.

## In Progress

- None.

## Next Up

- All three lanes' data-pipeline work from the `alt-data-sources` map is now complete and published (`people.json`, `wars.json`, `discoveries.json` all in `packages/shared-types`). Next real gap: `packages/web` needs `mapWarsAndConflictsToItems`/`mapInventionsToItems`-equivalent code re-added (removed in ticket 17 when they had nothing to consume) so the Wars & Conflicts / Discoveries & Inventions lanes actually render — not yet ticketed.
- Unit 9 (unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`), deferred out of scope for the data-pipeline work above.
- Unit 5: apply visual design tokens to the three-lane timeline — see `context/specs/00-build-plan.md` and `packages/web/docs/design-tokens.md`. Not yet spec'd.

## Open Questions

- Wars & Conflicts and Events & Inventions lanes stay empty in `packages/web` — `wars.json`/`discoveries.json` are both published now (tickets 20/25), but the frontend was never extended to consume them (see Next Up). The stale, pre-split `packages/shared-types/src/data/events.json` is now fully superseded by `wars.json`+`discoveries.json` together — still left in place untouched (no ticket has asked for its removal yet), but the case for deleting it is stronger now that both replacements exist.
- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision. Wikidata-specific, unaffected by the People/Pantheon switch.
- `historical-events.ts`'s `EVENT_TYPES` list misses some historically-significant items typed under a more specific Wikidata subclass than the 8 listed classes — confirmed World War II and the Thirty Years' War are absent from `wars.json` for this reason (pre-existing, not a ticket-20 regression; e.g. WWII is likely typed as "world war" Q103495, not plain "war" Q198). Needs a Tag-stage/query-completeness decision, not a reliability fix.
- `Person.reignPeriods` overlays only have a neutral dashed border today — Unit 5 should give them real, pixel-inset styling.

## Session Notes

- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` — Pantheon (CSV download → HPI-filtered description batch → HPI-filtered reigns batch) → Wikidata events, in that order.
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into the pipeline's own `data/output/`), then `npm run publish-data` to copy into `../shared-types/src/data/` (verify via `git status packages/shared-types` that only the expected files changed).
- `packages/shared-types/src/data/people.json`, `discoveries.json`, and `wars.json` are all live/published now (Pantheon ticket 17; discoveries ticket 20; wars ticket 25). The full `npm run publish-data` script is safe to run again for any future re-fetch.
- `npm install` must run from the repo root (single lockfile there).
- To extend the Wars/Discoveries region lookup table: `npx tsx transform/list-unmapped-countries.ts` from `packages/data-pipeline/` (People's tables are Pantheon-value-keyed and fully enumerated — no maintenance script needed).
