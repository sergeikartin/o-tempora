# 04 — API adversarial checker, repair-loop reuse, and ADR

**Status:** resolved
**Blocked by:** 01 (heading-aware excerpts and audit prompt contract), 02 (target selector, adversarial prompt/parser/merge, and policy v7). Can run in parallel with 03.

**What to build:** Wire the FIRE/Loki adversarial checker into the provider API verification workflow (`profiles verify`) with strict tool budgets, `claim_hash` reuse across repair rounds, CLI model/opt-out flags, and architectural documentation.

- In `packages/data-pipeline/src/profiles/verification/adversarial.ts`, implement `createAdversarialChecker(model: string): AdversarialChecker`:
  - Uses OpenAI Responses API with `web_search` and the existing `read_source` function tool (sharing the run's `SourceStore`).
  - Enforces hard per-Profile budgets: max **6 turns**, max **6 `web_search` calls**, max **8 `read_source` calls**, and `reasoning: { effort: 'medium' }`.
  - Parses and validates the returned JSON via `parseAdversarialResult(extractJson(response.output_text), targets)` and returns `{ checks, model: response.model }`.
- In `packages/data-pipeline/src/profiles/verification/runner.ts` (`verifyProfile`):
  - Accept an optional `adversarial?: AdversarialChecker` on `VerifyOptions`.
  - After `research()` and before `auditProfile()`, select targets via `selectAdversarialTargets()`. When `adversarial` is supplied and targets are non-empty:
    - Reuse cached checks from earlier repair rounds in the same `verifyProfile()` invocation whenever `claim_hash` matches an already-checked target, re-indexing `finding_index` and `path` to the current assessment.
    - Invoke `adversarial` only for uncached targets; merge reused + newly checked results via `mergeAdversarialResult()`.
    - Persist all fetched adversarial snapshots alongside writer snapshots, include `adversarial: { model, checks }` on `Report`, append the adversarial model to `report.models`, and pass `adversarial_notes` into `auditProfile()`.
  - Preserve existing retry semantics: if `sources.failures.size > 0` during adversarial fetching, treat as `retry` rather than deleting optional content.
- In `packages/data-pipeline/src/profiles/model-routing.ts` and `packages/data-pipeline/src/profiles/index.ts`:
  - Support `--adversarial-model=<OpenAI id>` (defaults to the `verify` researcher `--model`) and `--no-adversarial` on `profiles verify`.
  - Lazily construct `createAdversarialChecker()` so skipped Profiles still require no provider credentials.
- Update documentation and record the architectural decision:
  - Add a new ADR under `packages/data-pipeline/docs/adr/0033-profile-adversarial-verification-and-heading-excerpts.md` recording the decision, trade-offs, and backward compatibility with policies 2–6.
  - Update `packages/data-pipeline/docs/profile-verification.md` and `packages/data-pipeline/docs/profiles.md` for policy version 7, `--adversarial-model`, `--no-adversarial`, and heading-aware source snapshots.

## Acceptance criteria

- [x] `createAdversarialChecker` enforces the 6-turn, 6-search, and 8-read budgets and uses `read_source` against the shared `SourceStore`.
- [x] `verifyProfile` runs the adversarial check between `research()` and `auditProfile()` when targets exist, skips calling `adversarial` when zero targets are selected, and records `report.adversarial` and the adversarial model in `report.models`.
- [x] Across repair rounds inside `verifyProfile`, targets with unchanged `claim_hash` reuse their prior adversarial check results without invoking `adversarial` again; modified or new high-risk claims trigger a fresh adversarial check.
- [x] `profiles verify` accepts `--adversarial-model=<id>` and `--no-adversarial`, and skipped up-to-date Profiles still instantiate no API clients.
- [x] Transient fetch failures during adversarial retrieval yield `status: 'retry'` without stripping Profile prose.
- [x] Unit tests in `packages/data-pipeline/src/profiles/verification/verification.test.ts` cover `verifyProfile` with adversarial conflicts triggering repair, `claim_hash` reuse on untouched targets across repair rounds, zero-target skipping, fetch-failure retry behavior, and `--adversarial-model` / `--no-adversarial` routing.
- [x] ADR `0033` and living docs (`profile-verification.md`, `profiles.md`) are written and consistent with implemented behavior.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
