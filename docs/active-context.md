# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. `packages/web` typechecks and renders with real Pantheon People data. Unit 5 (visual design tokens) is next — note: Wars & Conflicts and Events & Inventions lanes are empty stubs until tickets 20/21 publish `wars.json`/`discoveries.json`.

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
- Fame Tier Redesign (`context/specs/06-fame-tier-redesign.md`): replaced top-N fame-tier ceilings with sitelink/HPI floors (`FAME_TIER_MIN_SITELINKS`/`FAME_TIER_MIN_HPI`). Live re-fetch under the new thresholds is done for People (via the Pantheon switch below); still open for Wars & Conflicts / Events & Inventions (tickets 20/25).
- Data-pipeline: output stage now writes to a pipeline-owned `data/output/` (gitignored); `npm run publish-data` copies it into `packages/shared-types` as an explicit, separate step (ticket 22).
- Data-pipeline: People lane switched from Wikidata to Pantheon 2.0 (ticket 17, `.scratch/alt-data-sources/`) — new fetch/tag/score pipeline keyed on Pantheon's HPI and occupation/region tables; descriptions come from secondary Wikidata SPARQL lookups keyed on the retained QID. Reign-period rewiring onto Pantheon data landed separately (ticket 19, below). Published to `packages/shared-types` with a CC BY-SA 4.0 data-license notice.
- `packages/web`: propagated the Pantheon `Person` shape (ticket 17) into the frontend — `shared/types` now only exports `Person`; `mapWarsAndConflictsToItems`/`mapInventionsToItems` were removed (not adapted) since `wars.json`/`discoveries.json` aren't published yet, so those two lanes construct but render empty. Could not visually verify in a browser (no Playwright Chrome binary in this environment).
- Ticket 19 (People: reign-period secondary enrichment): `fetch-reigns.ts` now sources its candidate Q-ID list from `people-pantheon.raw.csv`'s `wd_id` column (HPI ≥ `MIN_HPI`, mirroring `fetch-descriptions.ts`) instead of the retired Wikidata `people.raw.json`, and is wired back into `fetch/index.ts`. Verified live (not just reasoned about): re-ran the batched SPARQL reigns query against real Wikidata (5,554 rows across 77 batches), rebuilt `people.json`, and spot-checked known monarchs (Louis XIV 1643–1715, Queen Victoria 1837–1901, Napoleon's terms) — all correct. Coverage rose from 638 to 1,752 of 3,680 people with `reignPeriods` populated. Published just the updated `people.json` to `packages/shared-types` (not the full `publish-data` script, since `data/output/wars.json`/`discoveries.json` are still pending tickets 20/25 and aren't ready to publish).

## In Progress

- None.

## Next Up

- Ticket 20 (Discoveries & Inventions: Wikidata reliability fixes) and ticket 25 (Wars & Conflicts: Wikidata reliability fixes, blocked by 20) will re-fetch and publish `discoveries.json`/`wars.json` under the new Fame Tier Redesign thresholds.
- **Wars & Conflicts data-source reversal (2026-08-04)**: the CDB90 hybrid plan is fully reverted — Wars & Conflicts stays 100% Wikidata-sourced, full history. See `.scratch/alt-data-sources/issues/24-wars-source-reopen-wikidata-only.md` (decision) and `issues/25-wars-wikidata-reliability.md` (follow-on).
- Unit 9 (unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`), deferred out of scope for the data-pipeline work above.
- Unit 5: apply visual design tokens to the three-lane timeline — see `context/specs/00-build-plan.md` and `packages/web/docs/design-tokens.md`. Not yet spec'd.

## Open Questions

- Wars & Conflicts and Events & Inventions lanes stay empty in `packages/web` until tickets 20/21 publish real `War[]`/`Discovery[]` data and the frontend is extended to consume it. The stale, pre-split `packages/shared-types/src/data/events.json` is left in place, untouched, until a pipeline stage removes or replaces it.
- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision. Wikidata-specific, unaffected by the People/Pantheon switch.
- `Person.reignPeriods` overlays only have a neutral dashed border today — Unit 5 should give them real, pixel-inset styling.

## Session Notes

- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` — Pantheon (CSV download → HPI-filtered description batch → HPI-filtered reigns batch) → Wikidata events, in that order.
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into the pipeline's own `data/output/`), then `npm run publish-data` to copy into `../shared-types/src/data/` (verify via `git status packages/shared-types` that only the expected files changed).
- `packages/shared-types/src/data/people.json` is live/published (Pantheon, ticket 17). `wars.json`/`discoveries.json` remain unpublished — don't run `publish-data` again until tickets 20/21 land, or it'll publish those stale files alongside a fresh `people.json`.
- `npm install` must run from the repo root (single lockfile there).
- To extend the Wars/Discoveries region lookup table: `npx tsx transform/list-unmapped-countries.ts` from `packages/data-pipeline/` (People's tables are Pantheon-value-keyed and fully enumerated — no maintenance script needed).
