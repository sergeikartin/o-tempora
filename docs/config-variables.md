# Config Variables

## Locale

Paraglide uses `['url', 'baseLocale']` in `packages/web/vite.config.ts`. Paths under `/ru/` select Russian and other paths use English. One `project.inlang/` config generates gitignored `src/shared/paraglide/`. The web scripts compile Paraglide before dev, build, tests and typechecking so generated types exist before `tsc -b`.

## Detail Level

`DETAIL_LEVEL_FAME_SCORE_FLOORS` in `packages/shared-types` drives dataset splitting and the frontend filter. Files `<lane>.detail<N>.json` and `<lane>.detail<N>.ru.json` contain the entities added at that level.

- `locale-datasets.ts` loads levels 1 and 2 before the timeline’s first paint. It prefetches level 3 at idle except on Save-Data or `slow-2g`/`2g` connections. A request for level 4 also starts level 3.
- The Detail Level switch requests its selected level. An unresolved Entity Link requests deeper levels in order. Opening an entity with a Profile requests both deeper levels for its Connections.
- `use-detail-level-datasets.ts` merges loaded deltas and keeps them in memory for the session. The active Fame Score floor controls which loaded entries render.

## Web debug controls

`hasFeatureFlag(name)` checks the URL query for a developer flag. The current UI uses none. Dev builds expose `window.__setFameScoreFloors({ people, conflicts, milestones })` in the browser console and accept any subset of lanes.

## Profile credentials

API writing, standalone translation and saved-evidence audits use the selected provider’s key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`). API verification uses `OPENAI_API_KEY` and the key for the historical audit provider when it differs. The [Profile coordinator](../packages/data-pipeline/docs/profile-coordinator.md) uses conversation subagents and one-shot commands without provider keys. [Verification flags](../packages/data-pipeline/docs/profile-verification.md) · [Translation flags](../packages/data-pipeline/docs/profile-translation.md)

See [Observability](observability.md) for `VITE_GLITCHTIP_DSN`.
