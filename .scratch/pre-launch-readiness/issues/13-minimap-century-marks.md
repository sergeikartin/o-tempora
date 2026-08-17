Type: task
Status: done

# Century tick marks on the Minimap

## What to build

Resolved via `/grill-with-docs`. Supersedes `.scratch/frame-tier-zoom/issues/04-century-major-header-row-on-year-axis.md`, which proposed a century header row on `YearAxis` itself — that approach is dropped in favor of putting century marks on the Minimap instead.

- [x] A thin, non-interactive strip of century tick marks + labels runs along the Minimap's top edge (not full-height ticks crossing the ridge/river shape — those would visually compete with it).
- [x] Reuses the existing, currently-unused `centuryBoundaryForYear`/`centuryBoundariesInRange` helpers in `packages/web/src/shared/lib/format-year.ts` (already unit-tested) rather than reimplementing BCE/CE-aware century boundary logic — added `centuryTicksInRange` in `minimap.ts` on top, filtering out the one boundary whose true start precedes `PAN_MIN_DATE` (it would otherwise place a tick off the Minimap's left edge).
- [x] Ticks render at every century boundary across the full pannable range (`PAN_MIN_DATE` to present — ~29 boundaries at the current `PAN_MIN_DATE` of -801, though this count drifts as `PAN_MIN_DATE`/the current year change; don't hardcode it), at the Minimap's fixed per-year scale. Labels thin out — **not** via a flat minimum-pixel-spacing floor like `YearAxis`'s `MIN_DECADE_LABEL_SPACING_PX` (tried first, but century labels vary too much in text length — "1800s" vs. "8th century BCE" — for a flat floor to prevent overlap); instead each shown label's own estimated rendered width is carried forward so the next label is only shown once it clears it.
- [x] `pointer-events: none` on the century-mark layer — it must not interfere with the Minimap's existing click-to-jump, drag-viewport-rect, or hover-tooltip interactions.
- [x] The Minimap's height grows only as much as the new strip needs (16px, `MINIMAP_CENTURY_STRIP_HEIGHT_PX`); see [03](03-axis-duplication.md) for how that height is funded from the space freed by deleting the top/bottom `YearAxis` instances.
- [x] `npm run typecheck --workspace packages/web` and `npm run test --workspace packages/web` pass.

Implemented and verified visually in-browser at multiple viewport widths — ticks and labels render cleanly with no overlap.
