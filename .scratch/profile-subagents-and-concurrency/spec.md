Status: superseded by ../profiles-pipeline-v2/spec.md

Labels: ready-for-agent

# Subagent-Only Profile Pipeline, Remaining Correctness Fixes, and Safe Concurrency

## Problem Statement

The Profile pipeline has evolved around conversation subagents orchestrated by one-shot CLI commands (ADR 0030, ADR 0034), yet it still carries a parallel direct-provider API stack (`@anthropic-ai/sdk`, `@google/genai`, `openai`, API keys, `providers.ts`, `model-routing.ts`, `audit-saved.ts`, and `verify`/`audit`/`translate` CLI subcommands). Maintaining two execution stacks introduces unnecessary coupling—most visibly in `coordinator.ts`, which reconstructs prompts inside synthetic `research`/`complete` callbacks just to replay subagent replies through API loops—while leaving four concrete correctness gaps and two shared-state hazards that block running more than one QID at a time safely.

Specifically:
1. **Unused API stack & closure-replay coupling.** Direct provider SDKs, API keys, and multi-round API loops are unused in practice, complicate maintenance, and force `coordinator.ts` to couple tightly to `runner.ts` and `translation.ts` prompt-replay internals. Meanwhile, `claim_hash` adversarial reuse currently lives only inside the API loop in `runner.ts` and is unavailable to the coordinator's `english-adversarial` repair path.
2. **Remaining correctness defects:**
   - `wikipedia-qids.ts` fails immediately on a single transient MediaWiki HTTP `429`/`503` without honoring `Retry-After` or backing off.
   - `finalize.ts` resolves Connection URLs to Wikidata QIDs without deduplicating redirecting URLs that land on the same target QID (or self-links), inflating `meta.validation` counts and leaving dead entries that `output/profiles.ts` later silently drops.
   - `translation.ts` (`parseTranslationFields`) checks exact positional order of `\d+` tokens (`hash(text.match(/\d+/g))`), rejecting valid idiomatic Russian when clauses reorder numbers.
   - `build-data` / `publish-data` lack a post-write parity check confirming 1:1 agreement between `hasProfile: true` flags in `*.detail*.json`, emitted `profiles/<locale>/<slug>.json` files, and Connection target slugs/detail levels.
3. **Shared-state hazards under concurrency.** `prefetch.ts` reads, modifies, and rewrites a single `evidence/blocked-hosts.json` file, creating a lost-update race if two `prefetch` invocations overlap. `profiles prefetch` also runs strictly serially across QIDs with no `--concurrency` control.
4. **No deterministic batch-status or concurrency protocol.** Resuming a batch across five-hour usage windows (or coordinating multiple QIDs in parallel) currently requires ad-hoc disk inspection rather than a single deterministic status command and documented per-QID workspace isolation.

## Solution

Consolidate the Profile pipeline onto the subagent-only one-shot architecture, close the four remaining correctness defects, make shared caches concurrency-safe, and add explicit concurrency and batch-status support with a conservative default of **`1`**:

1. **Remove direct provider APIs and flatten the verification/translation core.** Drop `@anthropic-ai/sdk`, `@google/genai`, `openai`, API keys, `providers.ts`, `model-routing.ts`, `audit-saved.ts`, and the `verify`/`audit`/`translate` CLI subcommands. Replace multi-round callback loops with pure single-step `applyEnglishAudit()` and `applyRussianAudit()` functions, port `claim_hash` adversarial check reuse into `english-adversarial`, and record the decision in ADR `0035`.
2. **Fix remaining pipeline correctness defects.** Add `429`/`503` `Retry-After` + backoff to `wikipedia-qids.ts` (and `503` `Retry-After` to `sources.ts`), deduplicate resolved Connection QIDs and strip self-links in `finalize.ts` (remapping assessment paths), relax `parseTranslationFields()` digit checks to a sorted multiset, and add a deterministic build-time Profile parity check in `output/`.
3. **Make shared caches concurrency-safe and add `prefetch --concurrency` (default `1`).** Replace `evidence/blocked-hosts.json` with lock-free per-host files under `evidence/blocked-hosts/<sha256(host)>.json`, keep `*.wikipedia.org` serialized through `paceWikipedia()`, and add `--concurrency=<n>` (default `1`, max `3`) to `profiles prefetch`.
4. **Add `profiles status` and document coordinator concurrency (default `1`).** Add a read-only `profiles status` CLI command that inspects staged drafts, raw Profiles, pending assessments/adversarial checkpoints, verification reports, and Russian artifacts to report each QID's deterministic state and next CLI step, and codify `<workdir>/<QID>/` isolation and `concurrency` (default `1`, max `3`) in `profile-coordinator.md` and the coordinator agent prompts.

## User Stories

1. As a maintainer, I want zero LLM provider SDKs or API keys in `packages/data-pipeline`, so that the repo stays lean, requires no paid API credentials, and has a single execution architecture to test and maintain.
2. As a maintainer working on `coordinator.ts`, I want `english-audit` and `russian-audit` to call single-step `applyEnglishAudit()` and `applyRussianAudit()` functions directly instead of replaying fake callbacks through API loops, so that changing prompt assembly cannot break coordinator handoffs.
3. As a coordinator repairing a held English Profile, I want `english-adversarial` to reuse previously verified checks from the prior report when a high-risk finding's `claim_hash` is unchanged, so that fixing one passage does not waste subagent web searches on untouched Deep Facts.
4. As a maintainer running `finalize` or `english-audit`, I want transient MediaWiki HTTP `429` or `503` responses to honor `Retry-After` and retry with backoff, so that temporary Wikimedia blips do not abort a batch.
5. As a maintainer finalizing a Profile, I want two Connection URLs that redirect to the same Wikidata QID (or a self-link to the subject) deduplicated during `finalize` with assessment paths remapped cleanly, so that raw records, findings, and `meta.validation` counts match what Output ships.
6. As a Russian translator, I want natural Russian clause ordering that preserves all numeric values without forcing strict English left-to-right digit order to pass mechanical validation, so that idiomatic Russian translations do not fail before the fidelity audit.
7. As a maintainer running `build-data` or `publish-data`, I want a deterministic parity check verifying that every `hasProfile: true` entity has a readable `profiles/<locale>/<slug>.json` file, no orphan Profile files exist, and every `Connection.slug` resolves to an entity at its recorded `detailLevel`, so that broken Profile references can never ship to `shared-types` or `web`.
8. As a maintainer running multiple Profile commands or prefetch workers concurrently, I want blocked-host records stored in lock-free per-host files and subject caches written via UUID temp files, so that overlapping runs never corrupt or lose cache entries.
9. As a maintainer prefetching a batch of QIDs, I want `profiles prefetch --qids=...` to default to `--concurrency=1` and allow up to `--concurrency=3` while keeping `*.wikipedia.org` requests paced at least 1 second apart, so that concurrency is opt-in and always respects Wikimedia rate limits.
10. As a coordinator resuming across five-hour usage windows, I want `profiles status --qids=...` (or `--scope=legendary|mainstream|all`) to list each QID's exact deterministic state and next command, so that interrupted batches resume cleanly without manual file inspection.
11. As a coordinator orchestrating a batch, I want concurrency to default to `1` with an explicit option to run up to `3` QIDs in parallel using isolated `<workdir>/<QID>/` folders, so that I can scale throughput safely when quota and session slots allow.
12. As a maintainer managing published Profiles, I want all existing English approvals (policies 2–7) and Russian approvals (policy 1) to remain valid and publishable without forced regeneration.

## Implementation Decisions

### 1. Subagent-Only Simplification & Adversarial `claim_hash` Reuse (Ticket 01)

- **Package & config cleanup:**
  - Remove `@anthropic-ai/sdk`, `@google/genai`, and `openai` from `packages/data-pipeline/package.json` (and update `package-lock.json`).
  - Remove `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` from `.env.example` and update `docs/config-variables.md`.
- **Delete API-only files & CLI commands:**
  - Remove `src/profiles/providers.ts`, `src/profiles/model-routing.ts`, `src/profiles/verification/audit-saved.ts`, `prompts/profile-research.md`, and `prompts/profile-repair.md`.
  - Remove `verify`, `audit`, and `translate` commands from `src/profiles/index.ts`. (Saved-evidence re-audits remain supported by `profiles english-audit --qid=<QID>` because `loadEnglishAssessment()` reads saved reports.)
  - Remove `createResearcher` from `researcher.ts` (keep `englishAuditPrompt` in a lean module such as `verification/audit.ts` or slimmed `researcher.ts`), remove `createAdversarialChecker` and `AdversarialBudgetError` from `adversarial.ts`, and remove OpenAI `FunctionTool` / `readSourceTool` / `readSourceToolOutput` from `sources.ts`.
  - Define a lightweight `AgentRunMeta` (`{ model: string; reasoningEffort?: string | null; tokens: TokenUsage | null }`) in `src/profiles/usage.ts` to replace `Completion` metadata references.
- **Direct single-step persistence (zero closure replay):**
  - Replace `verifyProfile()`'s multi-round loop in `runner.ts` with `applyEnglishAudit({ filePath, subject, assessment, researcherModel, adversarial, audit, auditModel, snapshots, resolve, expectedRecordHash, repairs, now, force })`, which validates record freshness, runs mechanical + evidence + policy checks, persists snapshots, writes `*.verification.json`, updates `meta.review` / `approval`, clears `pending_assessment` and `pending_adversarial`, and returns `{ status: 'approved' | 'held' | 'skipped', blockers, reportPath }`.
  - Replace `translateProfile()`'s callback loop in `translation.ts` with `applyRussianAudit({ filePath, dates, fields, audit, models, force })`, which validates English approval freshness, runs `parseTranslationFields` and `translationBlockers`, writes `*.ru.translation.json` or `*.ru.translation.held.json` atomically with `randomUUID()` temp names, and returns `{ status: 'approved' | 'held' | 'skipped', filePath, blockers }`.
  - Keep `adversarial_disabled` accepted for reading historical v7 reports if present, while new coordinator reports always require `english-adversarial` whenever targets exist.
- **Coordinator `claim_hash` adversarial reuse:**
  - In `english-adversarial`, inspect prior verification reports (`<profile>.verification.json` and `verification-history/<QID>/*.json`) for previously validated `AdversarialCheck` entries whose `{ path, claim }` (`claim_hash`) and `finding.claim` match a current target and whose referenced counterevidence snapshots still pass `checkEvidence()`.
  - If all targets are covered by reusable checks, save `meta.pending_adversarial` directly and emit `{ status: 'reused', checks, conflicts }` without dispatching a subagent.
  - If only a subset of targets is uncached, prepare a task containing only the uncached targets; on `--result`, merge reused + fresh checks in `finding_index` order before saving `meta.pending_adversarial`.
- **Docs, agent files & ADR:**
  - Retire `.claude/agents/profile-verifier.md` and `.codex/agents/profile-verifier.toml` (which invoked `profiles verify`), and remove API sections from `packages/data-pipeline/docs/profiles.md`, `profile-coordinator.md`, `profile-verification.md`, and `profile-translation.md`.
  - Add ADR `packages/data-pipeline/docs/adr/0035-profiles-use-subagents-only.md` superseding the provider-API parts of ADR `0030` and ADR `0033`.

### 2. Remaining Pipeline Correctness Fixes (Ticket 02)

- **MediaWiki & source HTTP retry discipline:**
  - In `packages/data-pipeline/src/profiles/wikipedia-qids.ts`, wrap each batch fetch in up to 3 attempts retrying on HTTP `429`, `5xx`, or transient network errors. Honor numeric `Retry-After` (capped at 60 s) on `429`/`503`, falling back to exponential backoff starting at 5 s (`5_000 * 2 ** attempt`). Keep concurrency strictly at 1 and inject optional `fetch` / `wait` parameters for deterministic unit testing.
  - In `packages/data-pipeline/src/profiles/verification/sources.ts`, honor numeric `Retry-After` (capped at 60 s) on both `429` and `503` responses (not only `429`), using a 5 s fallback floor for `429`/`503` when `Retry-After` is absent.
- **Connection QID deduplication & self-link pruning (`finalize.ts`, `assessed-profile.ts`):**
  - During `finalizeFile()`, drop any Connection whose resolved QID equals the subject's own `qid` or duplicates an earlier kept Connection's `qid`.
  - Update `finalizedAssessment()` so finding/issue/covered/uncovered/subject_dates paths remap cleanly using the exact kept draft indices (rather than matching only by `wikipedia_url`, which could collide if the same URL appeared twice or diverge if two distinct URLs redirected to the same QID).
  - Update `meta.validation` counts to reflect deduplicated matched Connections accurately.
- **Multiset numeric validation in Russian translation (`translation.ts`):**
  - Replace the positional digit-order check `hash(text.match(/\d+/g) ?? []) !== hash(translated.match(/\d+/g) ?? [])` in `parseTranslationFields()` with a sorted multiset comparison `hash((text.match(/\d+/g) ?? []).sort()) !== hash((translated.match(/\d+/g) ?? []).sort())`, allowing natural Russian clause reordering while still blocking dropped, altered, or invented numbers.
  - Keep `TRANSLATION_POLICY_VERSION = '1'` unchanged (this strictly relaxes a false-positive gate; all previously approved translations remain valid) and update the digit wording in `profile-translation.md` and `profile-translation-repair.md` (bumping versions/hashes).
- **Build-time Profile referential integrity (`output/profiles.ts`, `output/index.ts`):**
  - Add `verifyBuiltProfiles(outputDir, datasets)` called at the end of `packages/data-pipeline/src/output/index.ts` (before `build-data` exits) asserting for both `en` and `ru`:
    1. Every entry with `hasProfile: true` across all three lanes has a corresponding readable JSON file at `profiles/<locale>/<slug>.json`.
    2. Every file in `profiles/<locale>/*.json` matches an entity marked `hasProfile: true` (no orphan files).
    3. Every `connection.slug` inside each written Profile exists in the built dataset at the recorded `lane` and `detailLevel`.
  - Fail `build-data` with a clear diagnostic error if any invariant breaks.

### 3. Concurrency-Safe Shared Caches & `prefetch --concurrency` (Ticket 03)

- **Lock-free per-host blocked-host cache (`prefetch.ts`):**
  - Replace the single shared `evidence/blocked-hosts.json` file with per-host files at `evidence/blocked-hosts/<hash(host)>.json`, written atomically via `writeJson()` (which already uses `randomUUID()` temp names) and deleted/overwritten cleanly on `--refresh` success.
  - Maintain the 7-day TTL (`BLOCK_TTL`) and continue ignoring transient `429`/`5xx`/timeout failures. On read, treat missing/expired/corrupt per-host files as unblocked; optionally fall back to reading legacy `blocked-hosts.json` if present (read-only) so existing local caches degrade smoothly.
- **Subject-cache concurrency verification (`subjects.ts`):**
  - `writeSubjectsCache()` already writes to `${cachePath}.${randomUUID()}.tmp` and renames atomically; add a unit test verifying parallel cold-start calls do not throw or corrupt the cache file.
- **Bounded `prefetch --concurrency` (default `1`):**
  - Add `--concurrency=<n>` to `profiles prefetch` (`coordinator.ts`, `index.ts`), validating an integer from `1` to `3`, defaulting to **`1`**.
  - Execute QID prefetches through a small bounded worker pool (order of emitted results remains deterministic in input QID order or per-QID structured output).
  - Ensure all `*.wikipedia.org` fetches across concurrent QID workers still serialize through `sources.ts`'s shared `paceWikipedia()` queue ($\ge 1$ s spacing), while third-party fetches stay bounded per QID.

### 4. `profiles status` CLI & Coordinator Concurrency Protocol (Ticket 04)

- **Read-only `profiles status` command (`status.ts`, `coordinator.ts`, `index.ts`):**
  - Command: `profiles status [--qids=Q1,Q2,... | --scope=legendary|mainstream|all]` (defaults to `--scope=mainstream`, meaning Legendary + Mainstream People & Milestones matching `.scratch/full-profile-coverage/map.md`, or explicit `--qids`).
  - For each QID, inspect `incoming/<QID>.json`, `<lane>/<QID>-*.en.json`, `*.en.verification.json`, `*.ru.translation.json`, `*.ru.translation.held.json`, `evidence/prefetch/<QID>.json`, and current dataset dates via `readProfileApproval()` / `approvedTranslation()` (zero network calls, zero LLM calls).
  - Classify each QID into one deterministic state:
    - `missing` $\rightarrow$ next: `prefetch` (or `write` if Source Map already exists)
    - `staged` $\rightarrow$ next: `preflight` / `finalize`
    - `draft-pending-adversarial` $\rightarrow$ next: `english-adversarial`
    - `draft-pending-audit` $\rightarrow$ next: `english-audit`
    - `english-held` $\rightarrow$ next: `english-repair` (reporting `remaining_draft_repairs` and `edited` flag)
    - `english-approved` $\rightarrow$ next: `russian-translation`
    - `russian-held` $\rightarrow$ next: `russian-translation` (field correction retry)
    - `bilingual-approved` $\rightarrow$ next: `done`
  - Emit structured JSON `{ summary: Record<State, number>, items: [...] }` so the coordinator can select the next batch and resume after any usage-window reset deterministically.
- **Coordinator concurrency protocol (default `1`):**
  - Update `packages/data-pipeline/docs/profile-coordinator.md`, `.claude/agents/profile-coordinator.md`, and `.codex/agents/profile-coordinator.toml`:
    - Default `concurrency = 1`; allow explicit caller override up to `3` (e.g., `concurrency=2` or `concurrency=3`).
    - Mandate per-QID scratch directories (`<workdir>/<QID>/`) so concurrent subagent tasks and replies never overwrite each other's JSON files.
    - Document batch startup (`profiles status` $\rightarrow$ `profiles prefetch --qids=... --concurrency=<n>`) and clean window-boundary pausing (leaving completed artifacts on disk for `profiles status` to resume).
    - Keep `build-data` and `publish-data` strictly sequential at batch end.

## Testing Decisions

- **What makes a good test:** Assert observable outputs across module and CLI boundaries—returned JSON payloads, persisted files, approval eligibility, retry counts/delays, and exit codes—using temporary directories, mocked fetch/resolve callbacks, and in-memory fixtures. Zero live network calls, zero LLM calls.
- **Agreed test seams:**
  1. **Direct apply & adversarial reuse seam (`verification.test.ts`, `translation.test.ts`):** `applyEnglishAudit`, `applyRussianAudit`, and `runCoordinatorCommand` (`english-adversarial` $\rightarrow$ `english-audit` $\rightarrow$ `english-repair` $\rightarrow$ `english-adversarial` reuse) verifying zero provider SDK imports, stale `input_hash` rejection, `claim_hash` reuse (both full reuse `skipped/reused` and partial reuse), and unchanged receipt validity for policies 2–7 and translation policy 1.
  2. **Correctness seam (`wikipedia-qids.test.ts`, `finalize.test.ts`, `translation.test.ts`, `output/profiles.test.ts`):** `resolveArticleQids` retry with `Retry-After` on `429`/`503`, `finalizeProfiles` QID deduplication + self-link removal + finding path remapping, `parseTranslationFields` reordered digits accepted vs. altered/dropped digits rejected, and `verifyBuiltProfiles` passing on clean builds and failing on missing file, orphan file, or invalid Connection slug/detailLevel.
  3. **Concurrency & cache seam (`prefetch.test.ts`, `subjects.test.ts`, `verification.test.ts`):** Concurrent `prefetch` calls writing distinct `evidence/blocked-hosts/<hash>.json` files without lost updates, `--concurrency` default `1` and bounded `> 1` execution with serialized `wikipedia.org` pacing, `sources.ts` `503` `Retry-After` handling, and parallel `loadSubjects` cold-start calls.
  4. **Status seam (`status.test.ts` or `verification.test.ts`):** `inspectProfileStatus` and `runCoordinatorCommand('status', ...)` covering every deterministic state transition (`missing` through `bilingual-approved`) and stale-date detection.

## Out of Scope

- Re-introducing or supporting direct provider API keys or Batch API execution.
- Scoped diff-only English re-audits (requires a separate verification-policy ADR).
- Automated cron/daemon batch runners outside conversation coordinator sessions.
- Changing `packages/shared-types` schemas or `packages/web` runtime behavior.
- Re-verifying existing approved English (policies 2–7) or Russian (policy 1) Profiles.

## Further Notes

- Tickets **01**, **02**, and **03** are independent and can execute in parallel (note minor non-overlapping edits in `translation.ts` between 01 and 02). Ticket **04** is blocked by **01** and **03** so the status classifier and coordinator concurrency docs align with the final subagent-only CLI and lock-free prefetch behavior.
- Completing Ticket **04** also resolves the technical prerequisites of `.scratch/full-profile-coverage/issues/03-resumption.md`.
