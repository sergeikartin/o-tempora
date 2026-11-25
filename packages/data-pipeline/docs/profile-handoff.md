# Profile handoffs between Codex and Gemini Neon

Pass the selected QIDs and `stop_after` boundary to the [Profile coordinator](profile-coordinator.md#wave-boundaries). Codex runs the Profile CLI to prepare and apply tasks. Gemini Neon can audit from the task file and write a reply using Easy MCP with Shell off.

Replace the example QID `Q935` with the selected QID in the commands and chat prompts.

## Task files

Both sessions use the same checkout. Resolve paths from the repository root for Easy MCP. Keep these files under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`.

| Command | Task | Reply |
|---|---|---|
| `prefetch --manifest` | — | `scout.json` |
| `english-audit` | `audit-task.json` | `audit-reply.json` |
| `english-repair` | `repair-task.json` | `repair-reply.json` |
| `russian-translation` | `ru-translation-task.json` | `ru-candidate.json` |
| `russian-audit` | `ru-audit-task.json` | `ru-audit-reply.json` |

Use one active workflow per QID. Retain completed artifacts when pausing. During repairs or retries, refresh the task and use a reply produced for that input hash. A `skipped` response leaves any existing task file untouched.

**Write boundary for Gemini Neon:** Never edit committed raw Profile files, verification reports, or Russian translation artifacts under `packages/data-pipeline/data/raw/profiles/<lane>/`. Write only to `tasks/<QID>/*-reply.json` (in Workflow A) or `incoming/<QID>.json` (in Workflow B) so the CLI remains the sole owner of validation, hashing, and receipts.

## A. Codex writes and repairs, Gemini Neon audits

**Codex draft wave.** Ask the coordinator to check status, scout and prefetch a Source Map (including upfront `dispute_urls`), dispatch `profile-writer`, preflight, finalize, and prepare `audit-task.json`.

> Use profile-coordinator for Q935, concurrency=1, stop_after=finalize. Share the audit task path and status. Leave the audit for Gemini Neon.

Run the following commands from the repository root. Prepare the audit once status reports `draft-pending-audit`.

```sh
profiles() { NODE_USE_ENV_PROXY=1 node packages/data-pipeline/src/profiles/index.ts "$@"; }
handoff=packages/data-pipeline/data/raw/profiles/tasks/Q935
profiles status --qids=Q935 --stage=draft-pending-audit --limit=1
profiles english-audit --qid=Q935 --out="$handoff/audit-task.json"
```

**Gemini Neon audit wave.** With Easy MCP Shell off, read the full task with `read_file`, evaluate the Profile and supplied evidence in one pass (the task prompt is self-contained), and write the reply with `write_file`. Copy `input_hash` unchanged and follow the prompt’s `result` schema. Report the reply path after writing it.

> Use Easy MCP read_file to open packages/data-pipeline/data/raw/profiles/tasks/Q935/audit-task.json. Audit it in one pass using the supplied material only. Use write_file to save packages/data-pipeline/data/raw/profiles/tasks/Q935/audit-reply.json with the task’s exact input_hash, model "gemini-4-neon", and the result requested by the task. Keep tool use to reading the task and writing the reply, and do not modify files under data/raw/profiles/<lane>/.

**Codex apply and repair wave.** Apply the English verdict with the command below. If held, ask `profile-writer` to carry out the prepared compact patch repair, preflight the reply, and apply it. Prepare a fresh audit immediately after repair.

```sh
profiles english-audit --qid=Q935 --result="$handoff/audit-reply.json"
```

> Use profile-coordinator for Q935 and apply the saved Gemini Neon English audit reply. If held, continue through stop_after=english-repair. Report the next stage and any fresh audit task path.

**Russian wave.** Once English is approved, Codex prepares `ru-translation-task.json` with `russian-translation --qid=Q935 --out=<task path>`. The translator saves `ru-candidate.json`. Codex passes that candidate to `russian-audit --qid=Q935 --candidate=<candidate path> --out=<fidelity task path>`. Send the prepared task to Gemini Neon, or continue with the Codex fidelity auditor.

> Use profile-coordinator for Q935, stop_after=russian-translation. Prepare the fidelity task from the saved candidate and return its path for Gemini Neon.

> Use Easy MCP read_file to open packages/data-pipeline/data/raw/profiles/tasks/Q935/ru-audit-task.json. Review every field for fidelity using the supplied English, Russian and glossary. Use write_file to save packages/data-pipeline/data/raw/profiles/tasks/Q935/ru-audit-reply.json with the unchanged input_hash, model "gemini-4-neon", and the requested result. Use only the supplied task, and do not modify files under data/raw/profiles/<lane>/.

> Use profile-coordinator for Q935, stop_after=russian-audit. Apply the saved Gemini Neon fidelity reply against the same ru-candidate.json and report the resulting stage.

Codex applies the fidelity verdict with `profiles russian-audit --qid=Q935 --candidate="$handoff/ru-candidate.json" --result="$handoff/ru-audit-reply.json"`. A Russian hold can resume through one correction and a fresh fidelity audit. [Translation workflow](profile-translation.md)

## B. Gemini Neon writes, Codex audits

Have Codex scout and prefetch the Source Map for the selected QID. With Shell on, Gemini Neon can research and cache evidence, stage the assessed Profile, and run preflight. It stops after staging. Codex finds the draft with `profiles status --qids=Q935 --stage=staged`, checks preflight and finalizes it, then runs the independent English audit.

> Write and stage Q935 using the writer and assessment prompts in packages/data-pipeline/prompts and its prefetched Source Map. Use profiles evidence for citations. Set writer.model to "gemini-4-neon", save packages/data-pipeline/data/raw/profiles/incoming/Q935.json, and run profiles preflight --qid=Q935. Leave finalization and audit for Codex.

> Use profile-coordinator for Q935, stop_after=english-audit. Resume from the Gemini Neon staged draft, use --model=gemini-4-neon as its finalization fallback, and run an independent Codex audit.

## C. Codex-only subagents

Use the role definitions in `.codex/agents/*.toml` from start to finish; those files are the single source of truth for per-role `model`, `model_reasoning_effort`, and tool restrictions. Stateless roles disable shell access and use the supplied task packet as their evidence boundary. Codex inherits the parent session’s sandbox and MCP services; if a stateless role lacks local file tools, the coordinator supplies the task verbatim and saves the returned reply. Claude Code’s matching stateless roles under `.claude/agents/` expose only `Read` and `Write`. [Codex custom agent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema)

> Use profile-coordinator for Q935, concurrency=1, through bilingual approval. Use fresh profile-scout, profile-writer, profile-auditor, profile-translator and profile-translation-auditor subagents for their respective tasks. Report any hold.

## Verify model provenance

Record the actual serving model ID in `writer.model` and every task reply’s top-level `model`. For Gemini Neon use `gemini-4-neon`. For Codex use the ID from the role’s runtime, such as `gpt-6.2-sol` or `gpt-6.2-astra`. Where runtime metadata is unavailable, confirm the model with the coordinator before saving a reply.

Check `meta.model` in the English Profile for the original writer. In the adjoining `*.verification.json`, check `models` for the assessment author and independent English auditor. After repair, the assessment author can be the repair model. In `*.ru.translation.json`, check each `models[].model` for the translator and Russian fidelity auditor.
