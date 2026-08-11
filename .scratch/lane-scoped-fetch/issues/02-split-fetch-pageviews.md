# 02 — Split `fetchPageviews` into per-lane raw files

**What to build:** `packages/data-pipeline/src/fetch/fetch-pageviews.ts` currently reads Wars/Discoveries together (People has no pageviews stage — Score's People path uses Pantheon HPI directly) and writes one combined `pageviews.raw.json`. Split it so it accepts a lane scope and writes one raw file per lane: `wars-pageviews.raw.json`, `discoveries-pageviews.raw.json`. A lane-scoped call only reads/fetches/writes that lane's entities and file.

**Status:** resolved

- [x] `fetchPageviews` accepts a lane parameter (`"wars" | "discoveries"` or both) and only processes the requested lane(s)' entities.
- [x] Each lane writes its own raw file (`<lane>-pageviews.raw.json`), not a shared combined file.
- [x] Existing per-lane pacing behavior (`batched-pageviews-fetch.ts`) is unchanged — only the output shape and lane-scoping change.
- [x] Test coverage: a lane-scoped call writes only that lane's file and leaves the other's raw file untouched.
