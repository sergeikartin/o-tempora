# 06 — One-time migration: split the existing combined raw files

**What to build:** A one-off, network-free script that reads the three existing checked-in combined raw files (`image-attribution.raw.json`, `pageviews.raw.json`, `wikipedia-extracts.raw.json`) and writes their contents out as the new per-lane files from issues 01–03, so the ~35 minutes of already-fetched data already in git is preserved instead of thrown away and re-fetched. Not a reusable tool — run once, then deletable, same posture as this pipeline's other one-off bootstrap scripts.

**Blocked by:** 01 — Split `fetchImageAttribution`; 02 — Split `fetchPageviews`; 03 — Split `fetchWikipediaExtracts`

**Status:** resolved

- [x] Script reads the three existing combined files from `data/raw/` and writes the 8 new per-lane files (3 image-attribution + 2 pageviews + 3 wikipedia-extracts) with identical data, no reshaping beyond splitting by lane key.
- [x] Old combined files (`image-attribution.raw.json`, `pageviews.raw.json`, `wikipedia-extracts.raw.json`) deleted once the new files are verified present and correct.
- [x] Verified manually (diff old combined data against new per-lane files) rather than unit tested, consistent with this repo's convention for one-off scripts.
- [x] `npm run build-data --workspace packages/data-pipeline` (after issue 05 lands) produces the same output using the migrated per-lane files as it did using the old combined files.
