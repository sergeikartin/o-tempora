# 03 — Coordinator one-shot english-adversarial subagent command

**Status:** resolved
**Blocked by:** 01 (heading-aware excerpts and audit prompt contract), 02 (target selector, adversarial prompt/parser/merge, and policy v7).

**What to build:** Add the one-shot `english-adversarial` command to the Profile coordinator CLI so conversation subagent runs execute the FIRE/Loki adversarial check with zero provider API keys, using the same hash-bound prepare/apply protocol as `english-audit` and `english-repair` (ADR 0030).

- Update `packages/data-pipeline/src/profiles/coordinator.ts` and `packages/data-pipeline/src/profiles/index.ts` to expose:
  - `profiles english-adversarial --qid=<QID> [--research=<file>] [--result=<file>]`
- **Prepare mode (no `--result`):**
  - Load the draft and its pending/saved assessment (same resolution rules as `english-audit`).
  - Run `selectAdversarialTargets(profile, assessment)`.
  - If zero targets are selected, emit `{ status: "skipped", targets: 0 }` and exit 0.
  - Otherwise emit `{ prompt, input_hash, targets }` where `input_hash` binds the prompt to `profileHash(record)` and `hash(assessment)`.
- **Apply mode (`--result=<file>`):**
  - Verify `input_hash` matches the current draft and assessment (rejecting stale replies).
  - Parse the agent reply with `parseAdversarialResult(result, targets)`, load every referenced snapshot ID from `data/raw/profiles/evidence/`, and run `checkEvidence()` on the returned counterevidence so fabricated or uncached quotes fail immediately before checkpointing.
  - Save `meta.pending_adversarial` on the raw draft record bound to `{ profile_hash, assessment_hash, model, checks }` and emit `{ status: "saved", checks: checks.length, conflicts: ... }`.
- **Integration with `english-audit` and `english-repair`:**
  - When `english-audit` runs (both prepare and apply), read `meta.pending_adversarial` if its `profile_hash` and `assessment_hash` match the current draft/assessment, merge its counterevidence via `mergeAdversarialResult()`, load all referenced adversarial snapshots into the audit `SourceStore`, pass `adversarial_notes` to `englishAuditPrompt()`, and persist `report.adversarial` and the adversarial model in `report.models`.
  - Clear `meta.pending_adversarial` when `verifyProfile()` writes the final report or when `checkpointEnglishRepair()` writes a modified draft/assessment.
- Update living docs and agent definitions in the same change:
  - `packages/data-pipeline/docs/profile-coordinator.md` (document `english-adversarial` between `finalize` and `english-audit`, plus skipping when no targets exist)
  - `.claude/agents/profile-coordinator.md` and `.codex/agents/profile-coordinator.toml` if their step summary needs alignment.

## Acceptance criteria

- [x] `profiles english-adversarial --qid=<QID>` emits `{ status: "skipped", targets: 0 }` when a draft has no high-risk targets.
- [x] `profiles english-adversarial --qid=<QID>` emits a hash-bound `{ prompt, input_hash, targets }` task when high-risk targets exist.
- [x] `profiles english-adversarial --qid=<QID> --result=<file>` rejects mismatched `input_hash`, malformed checks, or quotes absent from cached local evidence snapshots without mutating the draft.
- [x] Applying a valid reply stores `meta.pending_adversarial` bound to `profile_hash` and `assessment_hash`, and `english-audit` automatically merges the adversarial counterevidence, loads the adversarial snapshots, includes `adversarial_notes` in the audit prompt, and records `report.adversarial` + model provenance in the saved verification report.
- [x] `meta.pending_adversarial` is removed from the raw Profile once `english-audit --result=...` writes the report, and stale `pending_adversarial` is ignored after a draft or assessment change.
- [x] End-to-end coordinator tests in `packages/data-pipeline/src/profiles/verification/verification.test.ts` cover `skipped` emission, prepare/apply `english-adversarial`, stale `input_hash` rejection, merged counterevidence flowing into `english-audit`, and report/receipt approval.
- [x] `packages/data-pipeline/docs/profile-coordinator.md` (and coordinator agent instructions if applicable) reflect the new command.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
