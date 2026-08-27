# Detail Level: 4-tier redesign

Source of truth for the domain model: `CONTEXT.md`'s **Detail Level** entry and `docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md`. This spec exists to break that decision into implementable slices — it doesn't restate the reasoning, only the shape of the work.

## Summary

Replace the 2-position `Data Depth` preset (`Mainstream`/`Deep Cut`) and the independent 2-file `Payload Tier` network split (`tier0`/`tier1`) with one merged 4-level mechanism: **Detail Level**. The same 4 numbers per lane now drive both which entities render and which files get fetched over the network.

## The 4 levels

| Level | Name | Description (shown as helper text) |
|---|---|---|
| 1 | Legendary | Only top-tier, world-altering figures, major conflicts, and pivotal milestones. |
| 2 (default) | Mainstream | Essential historical figures, key conflicts, and primary milestones. |
| 3 | Specialized | Includes notable figures, secondary conflicts, and regional milestones. |
| 4 | Deep Cut | Displays high-density details, including niche figures, minor conflicts, and obscure milestones. |

Levels 2 and 4 are pinned to today's exact Mainstream/Deep Cut Fame Score floors — unchanged. Levels 1 and 3 are new.

## Per-lane Fame Score floors

| Lane | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| People | ≥91 (~72 entities) | ≥88 (189) | ≥84 (~504) | ≥80 (1342) |
| Conflicts | ≥86 (9) | ≥82 (23) | ≥78 (55) | ≥64 (124) |
| Milestones | ≥87 (23) | ≥82 (50) | ≥76 (107) | ≥55 (228) |

Levels 1/3 were derived by a constant per-lane multiplicative step on entity count (People ×2.67, Conflicts ×2.32, Milestones ×2.14) — not equal fame-score-point steps, and not equal-count steps (both were checked and rejected: linear-on-counts produces negative floors given how much smaller Mainstream is than Deep Cut). The step continues the count-ratio drift the original two presets already had between them, applied independently per lane. Exact thresholds should be re-derived against the live dataset at implementation time if entity counts have shifted meaningfully since this spec was written.

## Data layer

Each level ships as its own pipeline-output **delta file** per lane per locale — containing only the entities newly added versus the previous level, not a self-contained cumulative file. E.g. `people.detail3.json` holds only what's new between level 2's and level 3's floors. This replaces `<lane>.tier0.json`/`<lane>.tier1.json`.

## Loading policy

- Level 1 + Level 2 delta files: eager, block first paint. Combined byte cost is identical to today's eager `tier0` load, since level 2 == today's Mainstream exactly.
- Level 3 delta file: idle-prefetched in the background, same pattern as today's deferred `tier1`.
- Level 4 delta file: fetched strictly on demand, only once a user actually selects it.
- Once fetched, a level's data stays in memory even if the user dials back to a shallower level — no eviction. The goal is fewer network bytes, not less memory.

## UI

- The segmented control (today's 2-position `DataDepthSwitch`) becomes 4-position. Each stop is labeled with the level's name directly (`Legendary`/`Mainstream`/`Specialized`/`Deep Cut`).
- The selected level's description sentence renders as helper text below the control, updating live as the selection changes.
- The manual `FameScoreFilters` numeric inputs (raw per-lane floor, hand-editable) are removed from production UI entirely. A dev-console-only function provides the same override capability, stripped from the production bundle.
- With no manual UI path left, the "custom/unmatched" switch state (shown when a hand-edited value didn't match any preset) has no remaining production code path and is retired.

## Explicitly out of scope

- Any change to the 4 levels' Fame Score floors beyond what's listed above (open a follow-up if the real dataset's distribution makes these numbers land noticeably off-target).
- Reworking Search's contract beyond the simplification already noted in `CONTEXT.md` (reachable data is now exactly whatever the current Detail Level's cumulative delta files are — no separate change needed, `packages/web/docs/adr/0010-search-stays-inside-active-filters-and-payload-tiers.md`'s substance already covers it).

## Tickets

1. `issues/01-pipeline-outputs-detail-level-files.md` — pipeline output format change.
2. `issues/02-detail-level-switch-loading-and-ui.md` — chunked loading + UI, the user-visible feature.
3. `issues/03-retire-manual-fame-score-ui.md` — removes `FameScoreFilters` from production, adds dev-console override.
