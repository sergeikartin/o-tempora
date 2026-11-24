# 03 — Cross-family wave handoff protocol for Codex and Gemini Neon

Status: resolved
**Blocked by:** 01 (needs `--stage`, `--limit`, `--out`, `finalize --model`, and gitignored `tasks/` dir), 02 (needs canonical role subagent names).

**What to build:** Document the manual cross-family wave handoff workflow between **Codex** and **Gemini Neon** (connected via Easy MCP) alongside the **Codex-only** role-tiered workflow, standardizing `stop_after` boundaries, per-QID task/reply filenames under `data/raw/profiles/tasks/<QID>/`, and model provenance conventions.

- **Create `packages/data-pipeline/docs/profile-handoff.md`:**
  - Define the canonical per-QID handoff layout under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`:
    - `adversarial-task.json` / `adversarial-reply.json`
    - `audit-task.json` / `audit-reply.json`
    - `repair-task.json` / `repair-reply.json`
    - `ru-translation-task.json` / `ru-candidate.json`
    - `ru-audit-task.json` / `ru-audit-reply.json`
  - Document **Workflow A (Primary — Codex writes/repairs, Gemini Neon audits):**
    1. *Codex Wave 1 (`stop_after=english-adversarial` or `finalize`):* Runs `status`, `prefetch`, `profile-writer`, `preflight`, `finalize`, optional `profile-adversarial`, and prepares `tasks/<QID>/audit-task.json` with `--out`.
    2. *Gemini Neon Audit Wave (Easy MCP, zero-shell compatible):* Reads `tasks/<QID>/audit-task.json` with `read_file`, audits in a single pass with no web search or shell commands, and writes `tasks/<QID>/audit-reply.json` via `write_file` with `"model": "gemini-4-neon"`. Note the optional shell-enabled variant where Gemini Neon also runs `english-adversarial` (using Google Search + `profiles evidence`) and applies replies directly.
    3. *Codex Apply / Repair / Russian Wave:* Applies `audit-reply.json` via `english-audit --result`; for `english-held`, runs `english-repair` and re-prepares `audit-task.json` (`stop_after=english-repair`); for `english-approved`, runs `profile-translator` and either prepares `tasks/<QID>/ru-audit-task.json` for Gemini Neon to fidelity-audit or completes Russian in Codex.
  - Document **Workflow B (Reverse — Gemini Neon writes, Codex audits):** Using `incoming/<QID>.json` and `profiles status --stage=staged`.
  - Document **Workflow C (Codex-only tiered mode):** Using the role-specific `.codex/agents/*.toml` definitions end-to-end when Gemini Neon is not used.
  - Include short, copy-pasteable chat prompts for kicking off each wave in Codex and in Gemini Neon, plus how to verify cross-family provenance in `*.verification.json` (`models`) and `*.ru.translation.json`.
- **Update living Profile docs in the same change:**
  - `packages/data-pipeline/docs/profile-coordinator.md`: document `stop_after` wave boundaries (`finalize`, `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, `russian-audit`), default `data/raw/profiles/tasks/<QID>/` handoff paths with `--out`, `status --stage` / `--limit`, explicit `model` provenance, and link to `profile-handoff.md`.
  - `packages/data-pipeline/docs/profiles.md`: update the CLI table for `status --stage` / `--limit`, `finalize --model`, `--out` on prepare commands, `tasks/` gitignored directory, and link to `profile-handoff.md`.
  - `packages/data-pipeline/docs/profile-verification.md`: note cross-family auditing via wave handoff and provenance recording in `report.models`.

## Acceptance criteria

- [x] `packages/data-pipeline/docs/profile-handoff.md` exists and covers Workflow A (Codex writes, Gemini Neon audits — including the zero-shell Easy MCP audit flow), Workflow B (Gemini Neon writes, Codex audits), Workflow C (Codex-only tiered subagents), canonical `tasks/<QID>/` filenames, model provenance rules, and copy-pasteable wave prompts.
- [x] `packages/data-pipeline/docs/profile-coordinator.md` documents `stop_after` boundaries, `data/raw/profiles/tasks/<QID>/` + `--out`, `status --stage` / `--limit`, role subagent dispatch, and links to `profile-handoff.md`.
- [x] `packages/data-pipeline/docs/profiles.md` and `packages/data-pipeline/docs/profile-verification.md` accurately reflect every new flag (`--stage`, `--limit`, `--out`, `finalize --model`), the gitignored `tasks/` directory, and cross-family handoff.
- [x] All documented CLI commands, flags, file paths, and stage names match the actual implementation in `packages/data-pipeline/src/profiles/`.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
