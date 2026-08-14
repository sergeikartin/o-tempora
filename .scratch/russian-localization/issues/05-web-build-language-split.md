# 05 — Web: build-time language split (data layer)

**What to build:** A build-time language flag selects which lane dataset files (English or Russian) get bundled into `packages/web`'s build. Entity content renders in the selected language; UI chrome stays English on both builds for now (ticket 06 handles chrome).

**Blocked by:** 01, 02, 03, 04

**Status:** done (data-layer selector implemented and verified via the expected missing-file failure — full Russian-data rendering unverified until the pipeline's live fetch has actually run and produced the `.ru.json` files)

- [ ] A build-time selector (read at build time, not runtime — no client-side language switch) picks the English or Russian dataset file per lane for `packages/web`'s build.
- [ ] `TimelineEntry` and all downstream consumer code in `packages/web` are unchanged — the selector only changes which JSON file is bundled, not any application logic.
- [ ] Running the build with the Russian flag set produces a working app showing Russian entity names/taglines/descriptions (with English fallback wherever Russian data was missing), inside the existing, still-English UI chrome.
- [ ] Running the build with the English flag (or no flag) produces the same behavior as today, unchanged.
