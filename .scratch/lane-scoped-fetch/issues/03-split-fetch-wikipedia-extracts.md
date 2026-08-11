# 03 — Split `fetchWikipediaExtracts` into per-lane raw files

**What to build:** `packages/data-pipeline/src/fetch/fetch-wikipedia-extracts.ts` currently reads all three lanes together and writes one combined `wikipedia-extracts.raw.json` (`{ people, wars, discoveries }`), paced sequentially across all lanes combined at ~2 req/sec — this is the dominant cost of a full fetch (~35 min observed, per `docs/adr/0011-...md`). Split it so it accepts a lane scope and writes one raw file per lane: `people-wikipedia-extracts.raw.json`, `wars-wikipedia-extracts.raw.json`, `discoveries-wikipedia-extracts.raw.json`. A lane-scoped call only fetches that lane's entities, so `--lane=discoveries` costs ~1 minute (121 entities at 2/sec) instead of ~35 minutes.

**Status:** resolved

- [x] `fetchWikipediaExtracts` accepts a lane parameter and only processes the requested lane's entities (`loadPeopleEntries`/`loadWarsEntries`/`loadDiscoveriesEntries` become independently invocable).
- [x] Each lane writes its own raw file (`<lane>-wikipedia-extracts.raw.json`, a plain `Record<string, string>`), replacing the old combined `{ people, wars, discoveries }` shape.
- [x] The ~2 req/sec sequential pacing (`batched-wikipedia-extract-fetch.ts`) is preserved within a single lane-scoped run. Note in the file's own comments (or this stage's docstring) that this pacing is only a real courtesy ceiling if lane-scoped fetches aren't run concurrently — cross-reference the concurrency convention from issue 07.
- [x] Fix the stale docstring comment claiming this stage's output is "not yet consumed by Transform/Output" — it is (`transform/index.ts` reads it for the `description` field via `loadWikipediaExtractsFile()`).
- [x] Test coverage: a lane-scoped call writes only that lane's file and leaves the others' raw files untouched.
