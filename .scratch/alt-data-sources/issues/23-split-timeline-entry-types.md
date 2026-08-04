# 23 — Split HistoricalEvent into War/Discovery, shared TimelineEntry base

**What to build:** `packages/shared-types` gets a `TimelineEntry` base shape (`id`, `name`, `startYear`, `endYear?`, `fameScore`, `description`, `wikipediaUrl`) shared by `Person`, `War`, and `Discovery` — replacing the single `HistoricalEvent` type used by both Wars & Conflicts and Discoveries & Inventions. `Person.birthYear`/`deathYear` rename to `startYear`/`endYear` to match. `War` keeps `category: Category`, `regionTags: Region[]`, `partOfWarName?: string`. `Discovery` keeps `category: Category` and `regionTags: Region[]` (not dropped — Discoveries & Inventions can genuinely span more than one category, e.g. "discovery of America" is `exploration`, "invention of gunpowder" is `invention`; `tagInvention`'s current unconditional `"invention"` tagging is a Fetch-stage limitation, not a reason to weaken the type).

**Blocked by:** None — can start immediately. Reopens ticket 18's implementation (already shipped) and reshapes ticket 17's design before it starts.

**Status:** done

- [x] `packages/shared-types/src/index.ts`: added `TimelineEntry`; `Person`, `War`, `Discovery` all extend it. `Person.birthYear`/`deathYear` renamed to `startYear`/`endYear`. `Discovery` keeps `category`/`regionTags` (not dropped) per the "discovery of America is exploration, gunpowder is invention" reasoning.
- [x] `packages/data-pipeline/output/write-datasets.ts`: `buildEvents` split into `buildWars`/`buildDiscoveries`, sharing a new `validateEventRow` helper (extracted during code review to remove the duplicated 5-check validation block both functions started with). `buildPeople` updated for the rename.
- [x] `packages/data-pipeline/output/index.ts`: calls `buildWars`/`buildDiscoveries`.
- [x] Tests updated: `write-datasets.test.ts`'s war tests renamed/retargeted (`endDate`→`endYear`), plus two new `buildDiscoveries` tests (field passthrough, category-drop). 33/33 tests pass.
- [x] Verified end to end twice (before and after the code-review refactor): regenerated all three datasets, confirmed identical counts to the prior run (3694 people / 343 wars / 358 discoveries, same drop reasons), zero old field names (`birthYear`/`deathYear`/`date`/`endDate`) present anywhere in the output, and `Discovery` records correctly have no `partOfWarName` key at runtime, not just at the type level.

**Found during code review, fixed in the same unit:** two stale doc references in `packages/web/CLAUDE-decisions.md`/`CLAUDE-patterns.md` citing the now-removed `HistoricalEvent` type and `endDate` field — marked superseded with a pointer to the tracked `packages/web` follow-up, rather than left dangling. Also confirmed (via `tsc -b`, not just reasoning) that `packages/web` now fails to typecheck against `packages/shared-types` — expected and already tracked in `CLAUDE-activeContext.md`'s Open Questions, updated with the specifics this ticket adds.
