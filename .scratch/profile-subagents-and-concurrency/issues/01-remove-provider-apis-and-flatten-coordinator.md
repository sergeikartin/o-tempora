# 01 — Remove direct provider APIs, flatten coordinator core, and port adversarial reuse

Status: resolved
**Blocked by:** None — can start immediately (parallel with 02 and 03).

**What to build:** Remove all direct LLM provider SDKs, API keys, and API-only CLI commands so the Profile pipeline runs exclusively through the one-shot coordinator subagent protocol, eliminating closure-replay coupling between `coordinator.ts`, `runner.ts`, and `translation.ts` while porting `claim_hash` adversarial check reuse into `english-adversarial`.

- **Remove provider SDKs & credentials:**
  - Remove `@anthropic-ai/sdk`, `@google/genai`, and `openai` from `packages/data-pipeline/package.json` (and update `package-lock.json`).
  - Remove `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` from `.env.example` and update `docs/config-variables.md`.
- **Delete API-only modules, prompts, and CLI subcommands:**
  - Delete `packages/data-pipeline/src/profiles/providers.ts`, `src/profiles/model-routing.ts`, `src/profiles/verification/audit-saved.ts`, `prompts/profile-research.md`, and `prompts/profile-repair.md`.
  - Remove `verify`, `audit`, and `translate` subcommands from `packages/data-pipeline/src/profiles/index.ts` and `USAGE`.
  - Remove `createResearcher` from `src/profiles/verification/researcher.ts` (keeping `englishAuditPrompt`), remove `createAdversarialChecker` and `AdversarialBudgetError` from `src/profiles/verification/adversarial.ts`, and remove OpenAI `FunctionTool` / `readSourceTool` / `readSourceToolOutput` from `src/profiles/verification/sources.ts`.
  - Move the small model-metadata shape (`AgentRunMeta`: `{ model: string; reasoningEffort?: string | null; tokens: TokenUsage | null }`) into `src/profiles/usage.ts` (replacing imports of `providers.js`).
- **Flatten verification & translation persistence (remove closure-replay coupling):**
  - Replace `verifyProfile()`'s multi-round callback loop in `src/profiles/verification/runner.ts` with a direct single-step `applyEnglishAudit({ filePath, subject, assessment, researcherModel, adversarial, audit, auditModel, snapshots, resolve, expectedRecordHash, repairs, now, force })` function.
  - Replace `translateProfile()`'s callback-replay loop in `src/profiles/translation.ts` with a direct single-step `applyRussianAudit({ filePath, dates, fields, audit, models, force })` function (writing temp files with `randomUUID()`).
  - Update `src/profiles/coordinator.ts` (`englishAudit`, `russianAudit`) to call `applyEnglishAudit()` and `applyRussianAudit()` directly without synthetic `research`/`complete` callbacks or prompt re-hashing inside callbacks.
- **Port `claim_hash` adversarial check reuse into coordinator mode:**
  - In `coordinator.ts` (`englishAdversarial`), scan the subject's prior verification report (`<profile>.verification.json`) and `verification-history/<QID>/*.json` for validated `AdversarialCheck` records whose `claim_hash = hash({ path, claim })` matches a current target and whose referenced counterevidence snapshots still exist and pass `checkEvidence()`.
  - When all targets are covered by reusable checks, save `meta.pending_adversarial` directly and emit `{ status: 'reused', checks: checks.length, conflicts }`.
  - When only a subset is uncached, build the prepared task with only the uncached targets (binding `input_hash` to both reused and uncached targets); on `--result`, merge reused + fresh checks in `finding_index` order before saving `meta.pending_adversarial`.
- **Docs, agent definitions, and ADR:**
  - Remove or retire `.claude/agents/profile-verifier.md` and `.codex/agents/profile-verifier.toml` (which invoke the removed `profiles verify` command).
  - Update `packages/data-pipeline/docs/profiles.md`, `profile-coordinator.md`, `profile-verification.md`, and `profile-translation.md` to reflect the subagents-only workflow.
  - Write `packages/data-pipeline/docs/adr/0035-profiles-use-subagents-only.md` recording the decision (superseding the provider-API sections of ADR `0030` and ADR `0033`).

## Acceptance criteria

- [x] `@anthropic-ai/sdk`, `@google/genai`, and `openai` are removed from `packages/data-pipeline/package.json` and no source or test file imports them or references `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`.
- [x] `providers.ts`, `model-routing.ts`, `audit-saved.ts`, `prompts/profile-research.md`, `prompts/profile-repair.md`, and the `verify`/`audit`/`translate` CLI commands are removed; `.env.example` and `docs/config-variables.md` no longer advertise Profile provider keys.
- [x] `coordinator.ts` calls single-step `applyEnglishAudit()` and `applyRussianAudit()` directly with no synthetic `complete`/`research` callback wrappers.
- [x] `english-adversarial` reuses validated prior checks by `claim_hash` across repair rounds—emitting `{ status: 'reused', ... }` when all targets are unchanged and requesting subagent investigation only for new/modified targets when partially changed.
- [x] Existing English approvals (policies 2–7, including `adversarial_disabled` historical reports) and Russian approvals (policy 1) continue passing `readProfileApproval()`, `approvedTranslation()`, and `shipProfiles()`.
- [x] Unit tests in `packages/data-pipeline/src/profiles/verification/verification.test.ts` and `translation.test.ts` are migrated to `applyEnglishAudit` / `applyRussianAudit` and cover full + partial `claim_hash` reuse in `english-adversarial`.
- [x] ADR `0035` and updated living docs (`profiles.md`, `profile-coordinator.md`, `profile-verification.md`, `profile-translation.md`) match the subagents-only CLI; obsolete `profile-verifier` agent files are cleaned up.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
