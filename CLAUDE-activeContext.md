# Active Context

Update this file after every meaningful implementation change. Keep entries high-level — what was built and what decisions matter going forward, not a full implementation narrative. Detailed history remains available via `git log`.

## Current Phase

- Frontend scaffold

## Current Goal

- None. The Wars & Conflicts frontend unit is done — see Completed. Unit 5 (visual design tokens) is next, now unblocked since the timeline is genuinely three lanes.

## Completed

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

- Redesign the fame-tier concept into 3 named tiers (general public / educated / specialist) instead of numeric top-N — not yet spec'd. The fame-tier selector feature doesn't exist in the frontend yet at all.
- Unit 5: apply visual design tokens to the three-lane timeline — see `context/specs/00-build-plan.md` and `CLAUDE-patterns.md`. Not yet spec'd.

## Open Questions

- Large occupation-mapping backlog: hundreds of unmapped Wikidata occupation Q-IDs are dropping otherwise-eligible modern people from the dataset — real manual-judgment work, not started.
- The inventions/discoveries candidate set skews geography/prehistory-heavy relative to actual technological inventions (some candidates fall outside `Temporal.PlainDate`'s representable range) — needs a Transform/Score-stage product decision.
- `Person.reignPeriods` overlays only have a neutral dashed border today — Unit 5 should give them real, pixel-inset styling.
- 1980-present is still sparse in the people dataset, likely ambient Wikidata Query Service instability during the last fetch rather than a code bug — worth a re-fetch on a better day.
- Whether the "first mapped occupation claim in raw row order" primary-category rule needs a real fix.

## Session Notes

- Re-run Fetch: `cd packages/data-pipeline && npm run fetch` (overwrites all raw files; people → reigns → events in that order, since reigns depends on people).
- Rebuild dataset after a Fetch re-run: `npm run build-data` (writes into `../shared-types/src/data/` — verify via `git status packages/shared-types` that only the two expected files changed).
- `npm install` must run from the repo root (single lockfile there).
- To extend occupation/region lookup tables: `npx tsx transform/list-unmapped-occupations.ts` / `list-unmapped-countries.ts` from `packages/data-pipeline/`.
