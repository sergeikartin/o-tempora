# 01 — Pipeline outputs 4 Detail Level delta files

**What to build:** The data pipeline's Output stage computes and writes 4 delta files per lane (People/Conflicts/Milestones) per locale (English + Russian), replacing today's `<lane>.tier0.json`/`<lane>.tier1.json` pairs. A delta file for level N contains only the entities newly added versus level N-1's floor — not a self-contained cumulative file. See `.scratch/detail-level-tiers/spec.md` for the full per-lane threshold table and the reasoning behind it.

Level 2 and level 4's floors are pinned to today's exact Mainstream/Deep Cut thresholds (People 88/80, Conflicts 82/64, Milestones 82/55) — these must produce the identical entity sets as today's `tier0` and the Mainstream-to-Deep-Cut range of today's `tier1`. Level 1 and level 3's floors are new (spec has suggested starting values); re-derive the exact thresholds against the current live dataset rather than hardcoding the spec's numbers verbatim, since the underlying data may have shifted.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Each lane produces exactly 4 delta files per locale (8 files per lane, 24 total), named consistently with the project's existing dataset file-naming convention
- [ ] Delta files are non-overlapping and their union reconstructs the lane's full existing dataset (no entity lost, none duplicated across levels)
- [ ] Level 2's cumulative set (level 1 + level 2 files) exactly matches today's `tier0` entity set; level 4's cumulative set exactly matches today's `tier0` + `tier1` entity set
- [ ] Existing Field Fallback behavior (Russian value falling back to English per-field) still applies correctly within each new delta file
- [ ] Old `tier0`/`tier1` output files and any pipeline code paths that reference them are removed, not left alongside the new ones
- [ ] Pipeline-level tests cover the delta partitioning (non-overlap + reconstruction) and the level-2/level-4 equivalence to today's Mainstream/Deep Cut sets
