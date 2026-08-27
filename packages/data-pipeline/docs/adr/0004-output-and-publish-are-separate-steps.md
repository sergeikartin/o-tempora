---
status: accepted
---

# Output writes to a pipeline-owned directory; publishing is a separate step

`output/` writes final JSON into the pipeline's own `data/output/` (gitignored), and a separate `npm run publish-data` script copies it into `packages/shared-types/src/data/`. This decouples "compute the dataset" from "publish it for consumers" — a dataset can be regenerated and inspected locally without touching `packages/shared-types` until the maintainer chooses to publish it.
