# 02 — Role-specific subagent definitions for Codex and Claude

Status: resolved
**Blocked by:** None — can start immediately (parallel with 01).

**What to build:** Define dedicated role subagents in `.codex/agents/` (for Codex-only tiered execution) and matching files in `.claude/agents/` (for parity) so each stage of the Profile pipeline uses the minimum required toolset, enforces closed-world auditing mechanically, and records explicit model provenance.

- **Add four new Codex subagent definitions under `.codex/agents/`:**
  - `profile-adversarial.toml`: Investigates selected high-risk claims from a prepared `adversarial-task.json` using web search and `profiles evidence`, saves the reply JSON with `input_hash`, explicit `model` ID, and `result` to the requested output path.
  - `profile-auditor.toml`: Performs closed-world English Profile audits from a prepared `audit-task.json` without web search or external fetching; saves `audit-reply.json` with `input_hash`, explicit `model` ID, and `result`. Configure read/write-only constraints (or explicit no-network/no-shell instructions matching Codex's TOML schema) and a dedicated reasoning effort / model slot for Codex-only tiering.
  - `profile-translator.toml`: Translates approved English Profiles (or flagged correction fields) from `ru-translation-task.json` using the embedded glossary and fidelity self-check in `profile-translation.md`; writes `ru-candidate.json` with `input_hash`, explicit `model` ID, and `result`. No web search or shell.
  - `profile-translation-auditor.toml`: Performs independent Russian fidelity audits from `ru-audit-task.json`; writes `ru-audit-reply.json` with `input_hash`, explicit `model` ID, and `result`. No web search or shell.
- **Add four matching Claude subagent definitions under `.claude/agents/`:**
  - `profile-adversarial.md` (`tools: Read, Write, Bash, WebSearch`)
  - `profile-auditor.md` (`tools: Read, Write` — mechanically removes `Bash` and `WebSearch`)
  - `profile-translator.md` (`tools: Read, Write`)
  - `profile-translation-auditor.md` (`tools: Read, Write`)
- **Update existing writer and coordinator agent definitions (`.codex/agents/` and `.claude/agents/`):**
  - Update `profile-writer.toml` and `profile-writer.md` (preserving `model: opus` frontmatter in `.claude/agents/profile-writer.md` so `prompt.test.ts` stays green) to require recording the actual serving model in staged `writer.model` and using `profiles preflight`.
  - Update `profile-coordinator.toml` and `profile-coordinator.md` to dispatch the dedicated role subagents (`profile-writer`, `profile-adversarial`, `profile-auditor`, `profile-translator`, `profile-translation-auditor`), default task/reply files to `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`, and respect caller-specified `stop_after` wave boundaries.

## Acceptance criteria

- [x] `.codex/agents/` contains valid TOML definitions for `profile-coordinator`, `profile-writer`, `profile-adversarial`, `profile-auditor`, `profile-translator`, and `profile-translation-auditor`.
- [x] `.claude/agents/` contains matching Markdown definitions with `tools: Read, Write` on `profile-auditor`, `profile-translator`, and `profile-translation-auditor`, and `model: opus` preserved on `profile-writer.md`.
- [x] Every role definition instructs the agent to record its real serving model ID in `writer.model` (for drafts) or top-level `model` (for task replies) rather than leaving `model: null`.
- [x] `profile-coordinator.toml` and `profile-coordinator.md` route each step to its dedicated role subagent, use `data/raw/profiles/tasks/<QID>/` by default, and support `stop_after` boundaries.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
