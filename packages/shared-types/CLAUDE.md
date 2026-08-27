# packages/shared-types

The published dataset: `data-pipeline` writes it, `web` reads it. No source of its own — `src/index.ts` is hand-written TypeScript (types/constants), `src/data/*.json` is 100% pipeline-generated and never hand-edited (`code-conventions.md`).

- No build step: `package.json`'s `main`/`types` point straight at `src/index.ts`, consumed as source by the other two workspaces via Vite/tsc's own resolution — no compile, no test suite here.

## `src/index.ts`

Shared contracts both other packages import rather than redefining:

- Entity types — `TimelineEntry` (base fields every lane shares) extended by `Person`, `Conflict`/`ConflictEvent` (`ConflictEntry` union), `Milestone` (`MilestonePeriod`/`MilestonePoint` union); `Period`/`PointInTime`/`YearMonth` for the two date shapes (see `CONTEXT.md`'s **Mark**)
- Taxonomies — `CONFLICT_CATEGORIES`, `MILESTONE_CATEGORIES` + `MILESTONE_CATEGORY_TO_GROUP`, `REGIONS`, `OCCUPATION_DOMAINS`
- `DETAIL_LEVEL_FAME_SCORE_FLOORS` — the 4 per-lane Fame Score floors both data-pipeline (splits `src/data/*.json` by these) and web (its Detail Level switch) read, so the two can't drift apart (`CONTEXT.md`'s **Detail Level**, `docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md`)
- Layout constants (`AVG_CHAR_WIDTH_PX`, `REFERENCE_SCALE_PIXELS_PER_YEAR`, …) and helpers (`yearMonthToFractionalYear`, `wrapLabelLines`) shared because data-pipeline's one-time row packing and web's live rendering must agree on the same numbers

## `src/data/`

Per lane (`people`/`conflicts`/`milestones`) × Detail Level (`1`-`4`) × locale (base = English, `.ru` = Russian): `<lane>.detail<N>.json` / `<lane>.detail<N>.ru.json`. Each level's file is a delta — only the entities newly added versus the previous level's floor, not a self-contained cumulative file (web concatenates them client-side). Regenerated only via `data-pipeline`'s `publish-data` step (`packages/data-pipeline/CLAUDE.md`) — never edit these directly.

## Data & attribution

`LICENSE-DATA.md` covers the dataset's own license terms (separate from the MIT-licensed source code) — see the root `README.md`.
