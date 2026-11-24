# Profile handoffs between Codex and Gemini Neon

Pass the selected QIDs and `stop_after` boundary to the [Profile coordinator](profile-coordinator.md#wave-boundaries). Codex runs the Profile CLI to prepare and apply tasks. Gemini Neon can audit from the task file and write a reply using Easy MCP with Shell off.

Replace the example QID `Q935` with the selected QID in the commands and chat prompts.

## Task files

Both sessions use the same checkout. Resolve paths from the repository root for Easy MCP. Keep these files under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`.

| Command | Task | Reply |
|---|---|---|
| `english-adversarial` | `adversarial-task.json` | `adversarial-reply.json` |
| `english-audit` | `audit-task.json` | `audit-reply.json` |
| `english-repair` | `repair-task.json` | `repair-reply.json` |
| `russian-translation` | `ru-translation-task.json` | `ru-candidate.json` |
| `russian-audit` | `ru-audit-task.json` | `ru-audit-reply.json` |

Use one active workflow per QID. Retain completed artifacts when pausing. During repairs or retries, refresh the task and use a reply produced for that input hash. A `skipped` or `reused` response leaves any existing task file untouched.

## A. Codex writes and repairs, Gemini Neon audits

**Codex draft wave.** Ask the coordinator to check status, prefetch a Source Map, dispatch `profile-writer`, preflight and finalize. Choose `stop_after=english-adversarial` to finish or reuse the counterevidence checks and prepare the English audit. Choose `stop_after=finalize` to hand over a finalized draft. At that boundary, Codex can prepare the audit for QIDs already at `draft-pending-audit`. QIDs at `draft-pending-adversarial` need the adversarial wave first.

> Use profile-coordinator for Q935, concurrency=1, stop_after=english-adversarial. Share the audit task path and status. Leave the audit for Gemini Neon.

Run the following commands from the repository root. Prepare the audit once status reports `draft-pending-audit`.

```sh
profiles() { node --import tsx packages/data-pipeline/src/profiles/index.ts "$@"; }
handoff=packages/data-pipeline/data/raw/profiles/tasks/Q935
profiles status --qids=Q935 --stage=draft-pending-adversarial,draft-pending-audit --limit=1
profiles english-audit --qid=Q935 --out="$handoff/audit-task.json"
```

**Gemini Neon audit wave.** With Easy MCP Shell off, read the full task with `read_file`, evaluate the Profile and supplied evidence in one pass, and write the reply with `write_file`. Copy `input_hash` unchanged and follow the prompt’s `result` schema. Report the reply path after writing it.

> Use Easy MCP read_file to open packages/data-pipeline/data/raw/profiles/tasks/Q935/audit-task.json. Audit it in one pass using the supplied material only. Use write_file to save packages/data-pipeline/data/raw/profiles/tasks/Q935/audit-reply.json with the task’s exact input_hash, model "gemini-4-neon", and the result requested by the task. Keep tool use to reading the task and writing the reply.

With Shell enabled, Gemini Neon can also run the adversarial wave. Prepare `adversarial-task.json` with `english-adversarial --qid=Q935 --out=<task path>`. If prepared, use Google Search for neutral and falsification queries and `profiles evidence` to obtain snapshot IDs and excerpts. Write `adversarial-reply.json` and apply it with `english-adversarial --qid=Q935 --result=<reply path>`. Prepare the English audit after the checks are saved or the CLI reports `skipped` or `reused`.

**Codex apply and repair wave.** Apply the English verdict with the command below. If held, ask `profile-writer` to carry out the prepared repair, preflight the reply, and apply it. Prepare a fresh audit as soon as the repaired draft is ready. If its stage is `draft-pending-adversarial`, finish that wave first.

```sh
profiles english-audit --qid=Q935 --result="$handoff/audit-reply.json"
```

> Use profile-coordinator for Q935 and apply the saved Gemini Neon English audit reply. If held, continue through stop_after=english-repair. Report the next stage and any fresh audit task path.

**Russian wave.** Once English is approved, Codex prepares `ru-translation-task.json` with `russian-translation --qid=Q935 --out=<task path>`. The translator saves `ru-candidate.json`. Codex passes that candidate to `russian-audit --qid=Q935 --candidate=<candidate path> --out=<fidelity task path>`. Send the prepared task to Gemini Neon, or continue with the Codex fidelity auditor.

> Use profile-coordinator for Q935, stop_after=russian-translation. Prepare the fidelity task from the saved candidate and return its path for Gemini Neon.

> Use Easy MCP read_file to open packages/data-pipeline/data/raw/profiles/tasks/Q935/ru-audit-task.json. Review every field for fidelity using the supplied English, Russian and glossary. Use write_file to save packages/data-pipeline/data/raw/profiles/tasks/Q935/ru-audit-reply.json with the unchanged input_hash, model "gemini-4-neon", and the requested result. Use only the supplied task.

> Use profile-coordinator for Q935, stop_after=russian-audit. Apply the saved Gemini Neon fidelity reply against the same ru-candidate.json and report the resulting stage.

Codex applies the fidelity verdict with `profiles russian-audit --qid=Q935 --candidate="$handoff/ru-candidate.json" --result="$handoff/ru-audit-reply.json"`. A Russian hold can resume through one correction and a fresh fidelity audit. [Translation workflow](profile-translation.md)

## B. Gemini Neon writes, Codex audits

Have Codex prefetch the Source Map for the selected QID. With Shell on, Gemini Neon can research and cache evidence, stage the assessed Profile, and run preflight. It stops after staging. Codex finds the draft with `profiles status --qids=Q935 --stage=staged`, checks preflight and finalizes it, then runs the adversarial check and independent English audit.

> Write and stage Q935 using the writer and assessment prompts in packages/data-pipeline/prompts and its prefetched Source Map. Use profiles evidence for citations. Set writer.model to "gemini-4-neon", save packages/data-pipeline/data/raw/profiles/incoming/Q935.json, and run profiles preflight --qid=Q935. Leave finalization and audit for Codex.

> Use profile-coordinator for Q935, stop_after=english-audit. Resume from the Gemini Neon staged draft, use --model=gemini-4-neon as its finalization fallback, and run counterevidence checks and an independent Codex audit.

## C. Codex-only subagents

Use the `.codex/agents/` role definitions from start to finish. Astra handles writing, repairs and English audit. Sol handles coordination, adversarial research, translation and Russian fidelity audit, with reasoning effort set per role. Stateless roles disable shell access and use the supplied packet as their evidence boundary. Codex inherits the parent session’s sandbox and MCP services. If the session lacks local file tools for a stateless role, the coordinator supplies the task verbatim and saves the returned reply. Claude Code’s matching stateless roles expose only `Read` and `Write`. [Codex custom agent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema)

> Use profile-coordinator for Q935, concurrency=1, through bilingual approval. Use fresh profile-writer, profile-adversarial, profile-auditor, profile-translator and profile-translation-auditor subagents for their respective tasks. Report any hold or proposal.

## Verify model provenance

Record the actual serving model ID in `writer.model` and every task reply’s top-level `model`. For Gemini Neon use `gemini-4-neon`. For Codex use the ID from the role’s runtime, such as `gpt-6.2-sol`. Where runtime metadata is unavailable, confirm the model with the coordinator before saving a reply.

Check `meta.model` in the English Profile for the original writer. In the adjoining `*.verification.json`, check `models` for the assessment author, adversarial researcher when applicable, and independent English auditor. After repair, the assessment author can be the repair model. In `*.ru.translation.json`, check each `models[].model` for the translator and Russian fidelity auditor.
