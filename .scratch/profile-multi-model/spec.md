Status: superseded by ../profiles-pipeline-v2/spec.md

Labels: ready-for-agent

# Multi-Model Profile Generation: Role Subagents (Codex) and Manual Cross-Family Wave Handoff (Codex + Gemini Neon)

## Problem Statement

The Profile pipeline now runs exclusively through one-shot CLI commands and conversation subagents (ADR 0035), with hash-bound checkpoints at every stage boundary. However, two gaps prevent using different models cleanly for writing versus auditing:

1. **Single-model, over-privileged subagents in Codex-only runs.** `.codex/agents/` (and `.claude/agents/`) currently define only `profile-coordinator` and `profile-writer`. Adversarial research, English audit, Russian translation, and Russian fidelity audit have no dedicated role definitions, so they inherit the coordinator's default model and full toolset—missing both model tiering and mechanical enforcement of closed-world auditing (no web search or shell).
2. **Friction in manual cross-family handoffs between Codex and Gemini Neon.** Running Codex as writer/coordinator and Gemini Neon (connected via Easy MCP) as independent auditor breaks single-family blind spots, spreads load across two subscriptions, and eliminates coding-agent harness bloat on stateless audits. Today, however, three friction points slow manual handoffs:
   - `profiles status` cannot filter by stage (e.g., listing only QIDs waiting at `draft-pending-audit`), forcing manual scanning of the full status JSON.
   - `profile-coordinator.md` instructs the coordinator to store task and reply files *outside* the repository (`<workdir>/<QID>/`), which Easy MCP's project-scoped `read_file`/`write_file` tools cannot access directly.
   - Coordinator documentation has no named `stop_after` wave boundaries or canonical task/reply filenames, and writers/auditors often omit explicit `model` strings (falling back to `.claude/agents/profile-writer.md`'s `opus` or `"agent (model unreported)"`), obscuring cross-family provenance in `*.verification.json`.

## Solution

Adopt two complementary multi-model workflows without introducing API keys, provider SDKs, or headless CLI adapters:

1. **Stage-filtered `status` and a gitignored in-repo handoff workspace (CLI).**
   - Add `--stage=<stage1,stage2,...>` and `--limit=<n>` to `profiles status` so either runtime can fetch its exact work queue in one command.
   - Add a gitignored in-repo handoff folder (`packages/data-pipeline/data/raw/profiles/tasks/<QID>/`) and an optional `--out=<file>` flag on task-preparing coordinator commands so both Codex and Gemini Neon (via Easy MCP, even with Shell disabled) can exchange task and reply JSON files cleanly without dirtying `git status`.
   - Add optional `--model=<id>` on `profiles finalize` so non-Claude writers record truthful fallback provenance when a staged file omits `writer.model`.
2. **Role-specific subagent definitions (`.codex/agents/` and `.claude/agents/`).**
   - Add dedicated `profile-adversarial`, `profile-auditor`, `profile-translator`, and `profile-translation-auditor` definitions with role-appropriate model/effort settings and locked-down toolsets (read/write only for stateless audit and translation roles).
   - Update `profile-writer` to always populate `writer.model` and `profile-coordinator` to dispatch the dedicated role agents and honor `stop_after` wave boundaries.
3. **Manual Codex ↔ Gemini Neon wave handoff protocol (docs & playbook).**
   - Standardize `stop_after` wave boundaries (`finalize`, `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, `russian-audit`) and deterministic filenames inside `data/raw/profiles/tasks/<QID>/`.
   - Document concrete **Codex + Gemini Neon** handoff recipes (including the zero-shell stateless audit flow where Codex prepares/applies CLI commands and Gemini Neon reads `audit-task.json` and writes `audit-reply.json` with `"model": "gemini-4-neon"`), alongside Codex-only tiered execution.

## User Stories

1. As a maintainer running a **Codex + Gemini Neon** cross-family workflow, I want Codex to stop cleanly after `finalize` (or `english-adversarial`) and save prepared audit tasks inside a gitignored in-repo folder, so that Gemini Neon can read the task and write its reply directly via Easy MCP `read_file`/`write_file`—even when Shell execution is off.
2. As a maintainer switching between Codex and Gemini Neon, I want `profiles status --stage=draft-pending-audit` (and comma-separated combinations like `--stage=draft-pending-adversarial,draft-pending-audit`) to return only the QIDs waiting for the active runtime's wave, so that I never scan unrelated QIDs manually.
3. As a maintainer auditing cross-family verification quality, I want every staged draft and task reply to carry the real serving model string (e.g., `gpt-6.2-sol`, `gemini-4-neon`) into `meta.model`, `report.models`, and `*.ru.translation.json`, so that I can compare writer/auditor pairings accurately.
4. As a maintainer running **Codex only**, I want dedicated role subagents in `.codex/agents/` (`profile-writer`, `profile-adversarial`, `profile-auditor`, `profile-translator`, `profile-translation-auditor`) with separate model/effort configuration and restricted tool access, so that stateless auditors cannot run web searches or shell commands and cost stays tiered by role.
5. As a maintainer using **Claude Code**, I want matching role agent files under `.claude/agents/` with `tools: Read, Write` on stateless roles, so that `.claude/agents/` and `.codex/agents/` stay in structural parity.
6. As a maintainer running manual handoffs, I want deterministic filenames under `packages/data-pipeline/data/raw/profiles/tasks/<QID>/` (such as `audit-task.json`, `audit-reply.json`, `ru-candidate.json`), so that both runtimes know exact input/output paths without passing ad-hoc `/tmp/...` paths between chats.
7. As a maintainer pausing between waves or five-hour usage windows, I want task and reply files inside `data/raw/profiles/tasks/` to stay gitignored and leave `git status` clean, so that partial handoff artifacts are never committed accidentally.
8. As a maintainer managing already-published Profiles, I want zero changes to approval policies (English policies 2–7, Russian policy 1), receipt hashes, `shared-types`, or `packages/web`.

## Implementation Decisions

### 1. Stage-Filtered `status`, `--out` Task Writer, and Gitignored Handoff Workspace (Ticket 01)

- **Gitignored handoff directory:**
  - Add `packages/data-pipeline/data/raw/profiles/tasks/` to the root `.gitignore` (right beside `incoming/` and `evidence/`).
  - Export `TASKS_DIR = path.join(RAW_PROFILES_DIR, 'tasks')` from `packages/data-pipeline/src/profiles/paths.ts`.
- **`profiles status` filtering (`status.ts`, `coordinator.ts`, `index.ts`):**
  - Add `--stage=<s1,s2,...>` (accepting one or more comma-separated `ProfileStage` values; throw a clear error on unknown/empty stage names) and `--limit=<n>` (positive integer capping `items` after filtering while reporting `summary` across the filtered scope or clarifying `summary` counts for the returned items).
  - Keep `summary` reflecting the returned `items` so `sum(Object.values(summary)) === items.length` (matching existing invariants in `status.test.ts`).
- **Direct task file output (`--out=<file>`) on prepare commands (`coordinator.ts`, `index.ts`):**
  - Support optional `--out=<file>` on `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, and `russian-audit` when preparing a task (reject `--out` combined with `--result`).
  - When `--out` is passed and a task is prepared (not `skipped`/`reused`), write the prepared task JSON atomically via `writeJson(outFile, prepared)` and emit a compact summary `{ status: 'prepared', file: outFile, input_hash: prepared.input_hash, ... }` to stdout so the coordinator avoids dumping 80 KB of prompt JSON into terminal logs.
- **Truthful fallback model on `finalize` (`index.ts`):**
  - Support optional `--model=<id>` on `profiles finalize` (defaulting to `await loadWriterModel()` when omitted) so Codex or Gemini CLI runs can specify the writer model if a staged file lacks `writer.model`.

### 2. Role-Specific Subagent Definitions for Codex and Claude (Ticket 02)

- **Canonical role set in `.codex/agents/` (`.toml`) and `.claude/agents/` (`.md`):**
  | Role | Tool / Sandbox Scope | Responsibility |
  |---|---|---|
  | `profile-coordinator` | Workspace read/write + CLI execution | Orchestrates waves, honors `stop_after` and `concurrency` (default 1), dispatches role subagents |
  | `profile-writer` | Read, Write, Bash (`evidence`/`preflight`), WebSearch | Researches from Source Map, stages `incoming/<QID>.json` (setting `writer.model`), runs `preflight` |
  | `profile-adversarial` | Read, Write, Bash (`evidence`), WebSearch | Runs Loki neutral/falsification searches on prepared `adversarial-task.json`, writes `adversarial-reply.json` with explicit `model` |
  | `profile-auditor` | **Read & Write only** (no WebSearch, no Bash / read-only sandbox for network) | Single-pass closed-world English audit on `audit-task.json`, writes `audit-reply.json` with explicit `model` |
  | `profile-translator` | **Read & Write only** (no WebSearch, no Bash) | Translates approved English Profile (or flagged Russian fields) from `ru-translation-task.json` using the glossary and fidelity self-check, writes `ru-candidate.json` with explicit `model` |
  | `profile-translation-auditor` | **Read & Write only** (no WebSearch, no Bash) | Independent Russian fidelity audit on `ru-audit-task.json`, writes `ru-audit-reply.json` with explicit `model` |
- **Codex-only tiering:** Configure `.codex/agents/*.toml` with explicit comments/settings for `model` / `model_reasoning_effort` (and `sandbox_mode` where supported by Codex subagent TOML) so Codex-only runs separate writer/adversarial/auditor/translator configurations cleanly without breaking default behavior.
- **Claude parity:** Keep `.claude/agents/profile-writer.md`'s `model: opus` frontmatter intact (`prompt.test.ts` asserts `parseAgentModel` on it), and add the four sibling `.md` agent definitions with minimal `tools:` frontmatter (`Read, Write` for stateless roles).

### 3. Manual Cross-Family Wave Handoff Protocol: Codex + Gemini Neon (Ticket 03)

- **Canonical per-QID task/reply paths** under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`:
  - `adversarial-task.json` / `adversarial-reply.json`
  - `audit-task.json` / `audit-reply.json`
  - `repair-task.json` / `repair-reply.json`
  - `ru-translation-task.json` / `ru-candidate.json`
  - `ru-audit-task.json` / `ru-audit-reply.json`
- **Named `stop_after` wave boundaries in `profile-coordinator.md`:**
  - `finalize` — finish `prefetch` $\rightarrow$ `write` $\rightarrow$ `preflight` $\rightarrow$ `finalize` (ready for cross-family adversarial/audit).
  - `english-adversarial` — finish through checkpointing adversarial checks (or `skipped`/`reused`), then prepare `audit-task.json` via `--out`.
  - `english-audit` — finish through applying English audit verdicts (stops at `english-approved` or `english-held`).
  - `english-repair` — finish repairing held English drafts and checkpointing the repaired draft/assessment (ready for cross-family re-audit).
  - `russian-translation` — finish through writing `ru-candidate.json` and preparing `ru-audit-task.json` via `--out`.
  - `russian-audit` — finish through applying Russian fidelity verdicts (stops at `bilingual-approved` or `russian-held`).
- **Gemini Neon + Codex handoff playbook (`packages/data-pipeline/docs/profile-handoff.md`):**
  - **Primary pairing (Codex writes/repairs, Gemini Neon audits):**
    1. *Codex wave 1 (`stop_after=english-adversarial` or `finalize`):* Prefetches, writes, preflights, finalizes, optionally runs `english-adversarial`, and prepares `tasks/<QID>/audit-task.json` with `--out`.
    2. *Gemini Neon audit wave (works with Easy MCP Shell OFF):* Reads `tasks/<QID>/audit-task.json`, evaluates the Profile and evidence in a single pass with zero tool chatter, and writes `tasks/<QID>/audit-reply.json` with `"model": "gemini-4-neon"`. (With Shell ON, Gemini Neon can also run `english-adversarial` using `google:search` + `profiles evidence` and apply results directly.)
    3. *Codex apply / repair / Russian wave:* Applies `audit-reply.json` via `english-audit --result`, runs `english-repair` on any `english-held` QIDs (re-preparing `audit-task.json`), and for `english-approved` QIDs either runs Russian translation + prepares `ru-audit-task.json` for Gemini Neon to fidelity-audit, or finishes Russian in Codex.
  - **Reverse pairing (Gemini Neon writes, Codex audits):** Document the symmetric flow using `incoming/<QID>.json` and `profiles status --stage=staged`.
  - **Provenance hygiene:** Every reply written by Gemini Neon sets `"model": "gemini-4-neon"`; every reply/draft written by Codex sets its actual Codex model ID (e.g., `"gpt-6.2-sol"`). Never leave `"model": null` in cross-family trials.

## Testing Decisions

- **What makes a good test:** Verify observable CLI and module contracts—filtered `status` JSON outputs, `--out` file creation and stdout summary, rejection of invalid `--stage` / `--limit` / `--out`+`--result` combinations, `finalize --model`, and intact agent/prompt parsing—using temp directories and mocked callbacks with zero network calls.
- **Agreed test seams:**
  1. **Status filter seam (`status.test.ts`):** `inspectProfileStatus` and `runCoordinatorCommand('status', ...)` with single/multi `--stage`, `--limit`, invalid stage/limit errors, and `summary` consistency.
  2. **Coordinator `--out` & `finalize --model` seam (`verification.test.ts`, `finalize.test.ts`):** Prepare-mode `--out=<file>` writing valid JSON for `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, and `russian-audit`, skipping file write on `skipped`/`reused`, rejecting `--out` combined with `--result`, and round-tripping the written file into `--result`.
  3. **Prompt & agent config seam (`prompt.test.ts`):** Existing prompt hash checks and `parseAgentModel` on `.claude/agents/profile-writer.md` stay green; validate all `.codex/agents/*.toml` files parse cleanly (or remain syntactically valid TOML).

## Out of Scope

- Headless CLI adapter scripts (`claude -p`, `codex exec`, `gemini -p`) or automated cross-process orchestration.
- Re-introducing provider API keys or LLM SDK packages (ADR 0035 stays accepted).
- Changing verification policy version (`7`), translation policy version (`1`), receipt hashing, `shared-types`, or `packages/web`.
- Automated cleanup daemon for `data/raw/profiles/tasks/` (gitignored ephemeral files can be overwritten per run or cleared manually).

## Further Notes

- Tickets **01** and **02** have zero mutual dependencies and can execute in parallel. Ticket **03** depends on **01** and **02** so the handoff playbook documents exact verified CLI flags (`--stage`, `--limit`, `--out`, `--model`) and role agent names.
- This effort requires no new ADR: it refines execution ergonomics within ADR 0035's subagent-only boundary without changing verification rules or data contracts.
