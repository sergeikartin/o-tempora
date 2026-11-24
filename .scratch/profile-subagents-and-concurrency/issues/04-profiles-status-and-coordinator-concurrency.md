# 04 — profiles status resumption CLI and coordinator concurrency protocol (default 1)

Status: resolved
**Blocked by:** 01 (subagents-only CLI & docs), 03 (concurrency-safe caches and `prefetch --concurrency`).

**What to build:** Add a read-only `profiles status` CLI command that deterministically classifies every in-scope QID's pipeline stage and next action, and codify the coordinator's subagent concurrency protocol (default `1`, opt-in up to `3`) with per-QID workspace isolation so batches can run concurrently or pause and resume cleanly across usage windows.

- **Read-only status inspector (`packages/data-pipeline/src/profiles/status.ts`):**
  - Export `ProfileStage` and `inspectProfileStatus({ qids, scope, subjects, profilesDir, incomingDir })` (zero network calls, zero LLM calls):
    - Supports either explicit `qids` or `scope` (`legendary` | `mainstream` | `all`, where `mainstream` selects Legendary + Mainstream People & Milestones matching `.scratch/full-profile-coverage/map.md`, and `all` selects all subjects).
    - Reads dataset fame-score floors (`DETAIL_LEVEL_FAME_SCORE_FLOORS`) or Detail Level slices to resolve `--scope` deterministically without duplicating floor constants.
    - Inspects `incoming/<QID>.json`, `<lane>/<QID>-*.en.json`, `*.en.verification.json`, `*.ru.translation.json`, `*.ru.translation.held.json`, `evidence/prefetch/<QID>.json`, `readProfileApproval()`, `approvedTranslation()`, `readPendingAssessment()`, `meta.pending_adversarial`, `selectAdversarialTargets()`, and `completedRepairs()`.
    - Classifies each QID into one deterministic state and `next_command`:
      - `missing` (includes `prefetched: boolean`, `next_command`: `prefetch` or `write`)
      - `staged` (`next_command`: `preflight` / `finalize`)
      - `draft-pending-adversarial` (`next_command`: `english-adversarial`)
      - `draft-pending-audit` (`next_command`: `english-audit`)
      - `english-held` (includes `edited: boolean`, `remaining_draft_repairs`, `next_command`: `english-repair`)
      - `english-approved` (`next_command`: `russian-translation`)
      - `russian-held` (`next_command`: `russian-translation`)
      - `bilingual-approved` (`next_command`: `done`)
    - Detects stale approvals (e.g., dataset dates changed since verification, or Russian translation stale relative to current English) and classifies them into their exact required re-entry stage (`draft-pending-adversarial` / `draft-pending-audit` / `english-approved`) with a `reason` string.
  - Returns `{ summary: Record<ProfileStage, number>, items: StatusItem[] }`.
- **CLI wiring (`packages/data-pipeline/src/profiles/coordinator.ts`, `index.ts`):**
  - Add `profiles status [--qids=Q1,Q2,... | --scope=legendary|mainstream|all]` to `runCoordinatorCommand` and `USAGE` (rejecting `--qids` and `--scope` combined; defaulting to `--scope=mainstream` when neither is supplied).
- **Coordinator concurrency & resumption protocol (docs + agent instructions):**
  - Update `packages/data-pipeline/docs/profile-coordinator.md`, `.claude/agents/profile-coordinator.md`, and `.codex/agents/profile-coordinator.toml`:
    - Specify `concurrency` default **`1`** (serial, one QID at a time), with explicit opt-in up to **`3`** concurrent QIDs when requested by the caller.
    - Require per-QID temp workspaces (`<workdir>/<QID>/`) for prepared tasks and subagent replies so concurrent subagents never collide on file paths.
    - Document the resumption entry flow: run `profiles status` at batch start and after any usage-window reset to pick the next incomplete QIDs and resume each from its `next_command`.
    - Specify that `prefetch --qids=... --concurrency=<n>` and `finalize --qids=...` run as batch CLI commands at the coordinator, while `build-data` and `publish-data` run sequentially once at batch end.

## Acceptance criteria

- [x] `profiles status --qids=...` and `profiles status --scope=legendary|mainstream|all` make zero network calls and emit valid `{ summary, items }` JSON.
- [x] Every state (`missing` with/without Source Map, `staged`, `draft-pending-adversarial`, `draft-pending-audit`, `english-held`, `english-approved`, `russian-held`, `bilingual-approved`) is accurately detected and paired with the right `next_command`.
- [x] Stale English approvals (changed dataset dates) and stale Russian translations (changed English hash) are detected and mapped to their re-verification / re-translation stage rather than reported as approved.
- [x] Passing both `--qids` and `--scope`, or an unknown `--scope`, fails with a clear argument error.
- [x] Unit tests in `packages/data-pipeline/src/profiles/status.test.ts` cover all eight states, stale-date and stale-translation detection, scope filtering, and `runCoordinatorCommand('status', ...)`.
- [x] `packages/data-pipeline/docs/profile-coordinator.md`, `packages/data-pipeline/docs/profiles.md`, `.claude/agents/profile-coordinator.md`, and `.codex/agents/profile-coordinator.toml` document `profiles status`, default `concurrency = 1` (up to `3`), and `<workdir>/<QID>/` isolation.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
