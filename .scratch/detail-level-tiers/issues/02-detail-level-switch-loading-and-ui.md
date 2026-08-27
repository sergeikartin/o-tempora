# 02 — Detail Level switch: chunked loading + UI

**What to build:** The full user-visible Detail Level feature, wired end to end against the 4 delta files from ticket 01. A user can select any of 4 levels via a segmented control; the right data is fetched (eagerly, prefetched, or on demand depending on level) and rendered; the control shows the selected level's name and description. See `.scratch/detail-level-tiers/spec.md` for the full loading policy and UI copy.

**Loading policy:**
- Level 1 + level 2 delta files load eagerly, gating first paint — same cost as today's eager load.
- Level 3's delta file idle-prefetches in the background once first paint completes.
- Level 4's delta file fetches strictly on demand, only once a user actually selects level 4.
- Once fetched, a level's data stays in memory for the rest of the session even if the user dials back to a shallower level — never re-fetched, never evicted.

**UI:**
- The existing 2-position segmented control becomes 4-position, one stop per level, each labeled with the level's name directly (`Legendary`/`Mainstream`/`Specialized`/`Deep Cut`).
- The selected level's one-line description renders as helper text below the control, updating live as selection changes.
- Default selection on first load is level 2 (`Mainstream`), matching today's default.

Also update any living documentation that still describes the old two-file Payload Tier loading scheme (network-loading framing referencing "Tier 0"/"Tier 1"), so it reflects the 4-level scheme instead.

**Blocked by:** 01

**Status:** done

- [x] Selecting any of the 4 levels renders the correct entity set for all three lanes
- [x] Network panel confirms: level 1+2 chunks present in the initial load; level 3 chunk requested shortly after (idle), before the user touches the control; level 4 chunk is not requested until the user selects level 4
- [x] Switching between already-visited levels (e.g. 4 → 2 → 4) does not re-fetch previously loaded chunks
- [x] Control shows all 4 names as labels; helper text below shows the matching description and updates immediately on selection
- [x] First paint timing/byte cost with the default level-2 selection is unchanged from today's Mainstream load
- [x] Living docs describing the old `tier0`/`tier1` loading split are updated to describe the 4-level scheme

## Comments

`DataDepthSwitch` renamed to `DetailLevelSwitch` (4 buttons + description paragraph); `locale-datasets.ts` now exports a 24-entry `IMPORTERS` table (4 levels × 2 locales × 3 lanes) and `localeDatasetsPromise` (level1+2, unchanged Suspense contract), `level3DatasetPromise`/`requestLevel3Load` (idle-prefetch, same save-data/slow-connection fallback as the old Tier 1), `level4DatasetPromise`/`requestLevel4Load` (strictly on-demand, also triggers level 3's load since level 4's cumulative view needs it). `use-merged-datasets.ts` renamed to `use-detail-level-datasets.ts` (`useDetailLevelDatasets`), merging level 3/4 into the level 1+2 base as each resolves, module-scope promise singletons so nothing re-fetches on revisit. Verified: `npm run build --workspace packages/web` emits all 24 delta-file chunks as separate content-hashed files; `dist/index.html` preloads exactly the 6 EN level-1/2 chunks (`vite-plugins/eager-detail-modulepreload.ts`, renamed from `tier0-modulepreload.ts`). `docs/config-variables.md` and both packages' `CLAUDE.md` updated off the old tier0/tier1 framing. Added `use-detail-level-datasets.test.ts` covering the merge/loading-state logic (no prior test existed for this).
