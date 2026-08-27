# 01 — Pipeline outputs 4 Detail Level delta files

**What to build:** The data pipeline's Output stage computes and writes 4 delta files per lane (People/Conflicts/Milestones) per locale (English + Russian), replacing today's `<lane>.tier0.json`/`<lane>.tier1.json` pairs. A delta file for level N contains only the entities newly added versus level N-1's floor — not a self-contained cumulative file. See `.scratch/detail-level-tiers/spec.md` for the full per-lane threshold table and the reasoning behind it.

Level 2 and level 4's floors are pinned to today's exact Mainstream/Deep Cut thresholds (People 88/80, Conflicts 82/64, Milestones 82/55) — these must produce the identical entity sets as today's `tier0` and the Mainstream-to-Deep-Cut range of today's `tier1`. Level 1 and level 3's floors are new (spec has suggested starting values); re-derive the exact thresholds against the current live dataset rather than hardcoding the spec's numbers verbatim, since the underlying data may have shifted.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Each lane produces exactly 4 delta files per locale (8 files per lane, 24 total), named consistently with the project's existing dataset file-naming convention
- [x] Delta files are non-overlapping and their union reconstructs the lane's full existing dataset (no entity lost, none duplicated across levels)
- [x] Level 2's cumulative set (level 1 + level 2 files) exactly matches today's `tier0` entity set; level 4's cumulative set exactly matches today's `tier0` + `tier1` entity set
- [x] Existing Field Fallback behavior (Russian value falling back to English per-field) still applies correctly within each new delta file
- [x] Old `tier0`/`tier1` output files and any pipeline code paths that reference them are removed, not left alongside the new ones
- [x] Pipeline-level tests cover the delta partitioning (non-overlap + reconstruction) and the level-2/level-4 equivalence to today's Mainstream/Deep Cut sets

## Comments

Re-derived thresholds against the live dataset (`splitByDetailLevel` in `write-datasets.ts`, `DETAIL_LEVEL_FAME_SCORE_FLOORS` in `packages/shared-types/src/index.ts`): People 91/88/84/80, Conflicts 86/82/78/64, Milestones 87/82/76/55 — landed exactly on the spec's suggested numbers (live counts hadn't drifted meaningfully). Level 4's delta (detail4) is intentionally unbounded below level 3's floor rather than also floored at level 4's own number, mirroring today's Tier 1 (unbounded below Tier 0's floor) one level deeper — that's what makes the 4 deltas' union reconstruct the full dataset. Actual published counts: People 76/113/324/3220, Conflicts 9/14/32/107, Milestones 23/27/57/124. Data rebuilt via `npm run build-data && npm run publish-data --workspace packages/data-pipeline`; old tier0/tier1 files removed from both `data-pipeline/data/output/` and `shared-types/src/data/`.
