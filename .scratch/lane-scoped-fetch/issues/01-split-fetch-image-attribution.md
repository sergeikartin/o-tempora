# 01 — Split `fetchImageAttribution` into per-lane raw files

**What to build:** `packages/data-pipeline/src/fetch/fetch-image-attribution.ts` currently reads People/Wars/Discoveries together and writes one combined `image-attribution.raw.json`. Split it so it accepts a lane scope and writes one raw file per lane instead: `people-image-attribution.raw.json`, `wars-image-attribution.raw.json`, `discoveries-image-attribution.raw.json`. A lane-scoped call only reads/fetches/writes that lane's entities and file — it must not touch the other two lanes' files.

**Status:** resolved

- [x] `fetchImageAttribution` accepts a lane parameter (`"people" | "wars" | "discoveries"` or all three) and only processes the requested lane(s)' entities.
- [x] Each lane writes its own raw file (`<lane>-image-attribution.raw.json`), not a shared combined file.
- [x] Existing per-lane Commons `imageinfo` batching/pacing behavior (`batched-commons-image-attribution-fetch.ts`) is unchanged — only the output shape and lane-scoping change.
- [x] Test coverage: a lane-scoped call writes only that lane's file and leaves the others' raw files untouched.
