# Profile types and Output

Type: task
Status: resolved
Blocked by:

## What to build

Move the `Profile` types from `web` to `shared-types` and add the Output step that turns reviewed raw Profiles into shipped files. Shape and rules: `spec.md` (Pipeline) and `05-shipped-data-shape.md`.

- [x] `Profile` types (`overview`, `keyMoments[{date, title, text}]`, `deepFacts[{text, isLegend}]`, `connections[{slug, reason, name, lane, detailLevel}]`) live in `shared-types`; `web` imports them from there.
- [x] Output reads `packages/data-pipeline/data/raw/profiles/` and ships only `reviewed` and `edited` Profiles to `shared-types` `profiles/<locale>/<slug>.json`; `ru` carries the English Profile whole.
- [x] Output sets `hasProfile` on each row in both language files.
- [x] Each Connection resolves to `{slug, reason, name, lane, detailLevel}`; targets not in the dataset are dropped.
- [x] A Profile with unpaired `**` or other markup is rejected with a clear error.
- [x] Tests cover gating, `hasProfile`, Connection resolution and the markup check.
- [x] A `data-pipeline` ADR if Output needs a new stage; `packages/data-pipeline/CLAUDE.md` updated.
- [x] `data-pipeline` and `shared-types` typecheck, lint and tests pass.
