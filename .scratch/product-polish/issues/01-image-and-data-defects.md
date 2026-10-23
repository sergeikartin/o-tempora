Type: task
Status: done

Commits `21dd1b8` (pipeline) and `8018b94` (detail panel).

- Output stage normalises image URLs to `https` and `Special:Redirect/file`; id denylist drops Muhammad's image and attribution (`packages/data-pipeline/src/output/image-fields.ts`).
- Detail panel reserves a tinted, pulsing image slot and gives the close button a bordered backing.
- Datasets regenerated and published; no `http://` image URLs remain.
