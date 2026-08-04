# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. The Wars & Conflicts frontend unit is done — see Completed. Unit 5 (visual design tokens) is next, now unblocked since the timeline is genuinely three lanes.

## Completed

- Data-pipeline: Output stage now writes into a pipeline-owned `data/output/` (gitignored) instead of directly into `packages/shared-types`; a new `npm run publish-data` script (`output/publish.ts`, tested with fixture temp dirs) copies it across as an explicit, separate step. Ticket 22 of the alt-data-sources effort (`.scratch/alt-data-sources/`) — a prefactor ahead of the People/Pantheon and Wars/CDB90 work. Verified byte-identical to the old direct-write behavior by running both against the same raw inputs and diffing (couldn't compare against the currently-committed `packages/shared-types` data itself — see the note below on stale committed data). Code review caught a real bug in the first draft: `publish.ts`'s top-level `main()` call fired on import (not just direct execution), so importing `publishFiles` for testing silently republished data into `packages/shared-types` as a side effect — fixed with an entry-point guard. 26 tests pass, typecheck clean.
- Data-pipeline: Fame Tier Redesign (`context/specs/06-fame-tier-redesign.md`) — replaced the top-N fame-tier ceilings (`PEOPLE_FAME_TIER_CEILING`/`EVENTS_FAME_TIER_CEILING`) with `FAME_TIER_MIN_SITELINKS` (`generalPublic`/`educated`/`specialist` sitelink floors, specialist = 30) in `transform/score.ts`; `scoreAndRank` is now filter-then-sort with no count slice. Fetch's three query builders now share a `MIN_SITELINKS` constant (`fetch/queries/min-sitelinks.ts`) matching the specialist floor, replacing the old `> 20` literal. All code/tests done, typecheck and full test suite pass. **Not yet done: the live Fetch re-run.** An attempted re-fetch hit heavy Wikidata Query Service instability (repeated 502s and timeouts across most eras) and was aborted, leaving `data/raw/people.raw.json`, `people-reigns.raw.json`, and `events-historical.raw.json` as uncommitted, partial/patchy overwrites in the working tree (`events-inventions.raw.json` was never written — the crash happened before that stage). These need either a clean re-fetch retry or a `git checkout` back to the committed snapshots before `build-data` is run — do not run `build-data` against the current partial raw files. See Session Notes.
- Monorepo restructure: pipeline, shared-types, and frontend all live under `packages/*` as npm workspaces.
- Unit 1: Data pipeline scaffold + Fetch stage — paginated SPARQL client with retry/backoff, three query builders, run live against Wikidata.
- Unit 2: Score, Tag, Output stages. Added `packages/shared-types` for shared `Person`/`HistoricalEvent`/`Category`/`Region` types. Known limitation: primary-category assignment depends on SPARQL row order rather than Wikidata's real statement order — accepted, not fixed.
- Unit 3: Frontend scaffold (`packages/web`) — Vite + React 19 + TypeScript, mini-FSD skeleton, Steiger boundary enforcement.
- Unit 4: Render timeline with real data — two-lane (People/Events) `vis-timeline` canvas, `Temporal.PlainDate` throughout with the single legacy-`Date` adapter. Pan bounds calibrated against real dataset outliers. vis-timeline can't construct in bare jsdom, so tests mock it.
- Post-Unit-4: reworked lane interaction into two independently-scrolling, synced `Timeline` instances (2:1 height ratio), dedicated zoom buttons, wheel repurposed for scroll/pan.
- Data-pipeline: added wars-as-ranges, battle/treaty→war membership (`partOfWarName`), and ruler reign periods (`Person.reignPeriods`) — broad Wikidata P39 detection, no title allowlist.
- Data-pipeline: raised fame-tier ceilings (people, events) and widened Fetch to actually reach more candidates. Surfaced a large occupation-mapping backlog — see Open Questions.
- Wars & Conflicts frontend unit: third lane rendering wars/battles/treaties as ranges/points, reign-period overlays inside a person's lifespan bar. Built TDD.
- Data-pipeline bug fix: People lane was empty in the default 1800s view because an unordered Fetch exhausted its page budget entirely within antiquity. Fixed by bucketing Fetch by birth-year era; added an "implausible lifespan" drop rule to catch bad upstream Wikidata data. Roughly doubled the usable people dataset and extended max birth year into the modern era.

## In Progress

- None.

## Next Up

- Finish the Fame Tier Redesign unit: re-run `npm run fetch --workspace packages/data-pipeline` cleanly (retry or after `git checkout` of the partial `data/raw/*.json` files), then `npm run build-data --workspace packages/data-pipeline` followed by `npm run publish-data --workspace packages/data-pipeline`, then spot-check `people.json`/`events.json` have nothing below 30 sitelinks per the spec's Verification Checklist.
- Unit 9 (separate, still-unspecced): frontend fame-tier selector (`features/filter-by-fame-tier`) reading the new `FAME_TIER_MIN_SITELINKS` thresholds — deferred out of scope for the data-pipeline unit above.
- Unit 5: apply visual design tokens to the three-lane timeline — see `context/specs/00-build-plan.md` and `CLAUDE-patterns.md`. Not yet spec'd.

## Open Questions

- Large occupation-mapping backlog: hundreds of unmapped Wikidata occupation Q-IDs are dropping otherwise-eligible modern people from the dataset — real manual-judgment work, not started.
- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some candidates fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision.
- `Person.reignPeriods` overlays only have a neutral dashed border today — Unit 5 should give them real, pixel-inset styling.
- 1980-present is still sparse in the people dataset, likely ambient Wikidata Query Service instability during the last fetch rather than a code bug — worth a re-fetch on a better day.
- Whether the "first mapped occupation claim in raw row order" primary-category rule needs a real fix.

## Session Notes

- Fame Tier Redesign unit (2026-08-03): a live Fetch re-run hit widespread Wikidata Query Service 502s/timeouts (most eras in the `people` bucket loop failed outright), then crashed uncaught while fetching inventions candidates (`fetch-events.ts`'s `fetchEvents` has no page/bucket-level try/catch guard for the first-page case, unlike the people/reigns fetchers — pre-existing, out of scope for this unit). Left `data/raw/people.raw.json`, `people-reigns.raw.json`, `events-historical.raw.json` as uncommitted partial overwrites; `events-inventions.raw.json` untouched. Check `git status packages/data-pipeline/data/raw` before doing anything else with Fetch.
- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` (overwrites all raw files; people → reigns → events in that order, since reigns depends on people).
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into the pipeline's own `data/output/`, gitignored), then `npm run publish-data` to copy it into `../shared-types/src/data/` (verify via `git status packages/shared-types` that only the two expected files changed).
- Confirmed while implementing the `data/output/` restructuring (2026-08-04): `packages/shared-types/src/data/people.json`/`events.json` are already stale relative to the `data/raw/*.json` committed in the Fame Tier Redesign commit (`85e0100`) — that commit updated the raw snapshots but never re-ran `build-data`/committed the regenerated output (per the "Not yet done" note above). Running `build-data`+`publish-data` today against the current raw files produces a large diff against the currently-committed shared-types data, entirely expected and unrelated to any pipeline-logic bug — it's the same still-pending "Finish the Fame Tier Redesign unit" step below.
- `npm install` must run from the repo root (single lockfile there).
- To extend occupation/region lookup tables: `npx tsx transform/list-unmapped-occupations.ts` / `list-unmapped-countries.ts` from `packages/data-pipeline/`.
