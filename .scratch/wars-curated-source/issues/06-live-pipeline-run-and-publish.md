# 06 — Live pipeline run, publish, and verify end to end

Type: task
Status: open
Blocked by: 02, 03, 04, 05

## Question

Run the full pipeline against the real hand-off list, end to end:

1. `npm run fetch --workspace packages/data-pipeline` — bootstrap (ticket 05, run once) then live enrichment (ticket 02) against every curated QID.
2. `npm run build-data --workspace packages/data-pipeline` — Score/Tag/Output (ticket 03).
3. `npm run publish-data --workspace packages/data-pipeline` — copy into `packages/shared-types`.

Verify, not just "it ran without throwing":

- Every curated QID either resolved or shows up in the `DropReport` with a sensible reason — spot-check a few drops by hand against Wikidata to confirm they're genuine (stale/redirected QID, no date claim at all), not a query bug.
- Spot-check a handful of entries across categories for correct `description`, `image`, `regionTags`, and date precision (year-only vs. month, matching what Wikidata actually claims).
- Confirm at least one real Container/nesting chain survives into the output (e.g. an umbrella conflict with a `parentId`-linked child), proving `parentId` works end to end — per the spec's decision that this pass shouldn't need artificial examples.
- Confirm the shape split looks right: entries with a genuine Wikidata start+end became `War`s, single-date entries became `WarEvent`s, independent of `category`.
- `npm run test --workspace packages/data-pipeline` and `npm run typecheck --workspace packages/data-pipeline` both clean.

## Answer
