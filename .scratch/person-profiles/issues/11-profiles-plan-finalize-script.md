# `profiles` plan/finalize script

Type: task
Status: resolved
Blocked by:

## What to build

The deterministic half of the Profile pipeline described in `packages/data-pipeline/docs/adr/0021-profiles-generated-from-model-knowledge-and-human-gated.md`: a `profiles` script with a plan step (what the `profile-writer` agents should write) and a finalize step (validate and record what they wrote).

- [x] Plan lists entities needing a Profile, skipping any already at the current `prompt_hash`.
- [x] Stale Profiles (older `prompt_hash`) are regenerated only on an explicit flag.
- [x] Records marked `edited` are never overwritten.
- [x] Finalize validates each written file against the raw Profile shape and leaves new ones at `draft`.
- [x] One JSON per Profile under `packages/data-pipeline/data/raw/profiles/`.
- [x] Tests cover skip, stale-with-flag, and edited protection.
- [x] `packages/data-pipeline/CLAUDE.md` documents the command.
- [x] `data-pipeline` typecheck, lint and tests pass.
