# Profile coordinator

Give the coordinator the QIDs selected in chat and the requested outcome. Set concurrency to 1 by default. The caller can explicitly raise it to 2 or 3; when processing multiple QIDs, pipeline scout/prefetch for the next QID while the current QID is in audit or translation. Keep one active workflow per QID and store its prepared tasks and replies in gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/` using the [task filenames](#task-files) below.

Run `status --qids=Q1,Q2,...` at batch start and after a usage-window reset. Select the next incomplete QIDs and resume each at its `next_command`. Use `--stage=<stage1,stage2,...>` for a wave queue and `--limit=<n>` to cap the returned items and their summary counts. Check saved replies before dispatching new work; for Russian, check `ru-candidate.json` and `ru-audit-task.json` when resuming an in-progress run. Use `--scope=legendary`, `--scope=mainstream` or `--scope=all` for dataset-wide inspection (default: Legendary and Mainstream People and Milestones). Leave completed artifacts on disk when pausing.

For QIDs needing a Source Map, dispatch `profile-scout` to write `tasks/<QID>/scout.json` and run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json` (or fall back to `prefetch --qids=... --concurrency=<n>` without a manifest). Batch validated QIDs into `finalize --qids=...`. For an existing draft without a current pending assessment, resume from its verification report. For approved English, resume at Russian translation.

Run `NODE_USE_ENV_PROXY=1 node packages/data-pipeline/src/profiles/index.ts <command>` from the repo root (or `npm run --silent profiles --workspace packages/data-pipeline -- <command>`). Prepare task files with `--out=<file>` and apply saved replies with `--result=<file>`. Resolve relative paths from the command’s working directory (the current directory for direct `node`, or `packages/data-pipeline` under npm workspaces).

## Wave boundaries

`stop_after` is a chat instruction to the coordinator. Stop at the requested boundary for each QID, prepare the next task where called for, and report the latest stage, any blocker, and available task paths.

| `stop_after` | Checkpoint |
|---|---|
| `finalize` | Scout, prefetch, write, validate, finalize, and prepare `audit-task.json`. |
| `english-audit` | Apply the English verdict and report `english-approved` or `english-held`. |
| `english-repair` | Apply the repair, save the updated draft and `tasks/<QID>/pending.json`, and prepare a fresh `audit-task.json` (or report any blocker). |
| `russian-translation` | Save `ru-candidate.json` and prepare `ru-audit-task.json` from it. If translation is already current, report `bilingual-approved`. |
| `russian-audit` | Apply the fidelity verdict and report `bilingual-approved` or `russian-held`. |

## Subagent workflow

Dispatch each model task in a fresh context with its exact input and output paths, and confirm each subagent’s serving model ID for provenance. Canonical worker instructions live in `packages/data-pipeline/docs/profile-roles/` ([`profile-scout.md`](profile-roles/profile-scout.md), [`profile-writer.md`](profile-roles/profile-writer.md), [`profile-auditor.md`](profile-roles/profile-auditor.md), [`profile-translator.md`](profile-roles/profile-translator.md), [`profile-translation-auditor.md`](profile-roles/profile-translation-auditor.md)); thin harness stubs in `.claude/agents/`, `.codex/agents/`, and `.agents/agents/` point here and to those files. If a stateless Codex role lacks local file tools, pass its role instructions and the complete prepared task in its message and save its returned JSON yourself. Policy, corroboration, and receipt rules live in [verification](profile-verification.md) and [translation](profile-translation.md).

### English

1. **Scout and prefetch.** Dispatch `profile-scout` to run neutral and falsification searches and save `tasks/<QID>/scout.json` (`core_urls`, paired `deep_fact_candidates` with optional `dispute_urls`, and `dispute_urls`), then run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json`. The resulting Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json` caches Wikipedia plus the manifest URLs and annotates each Deep Fact candidate with `dispute_source_ids` and `corroboration_ready`.
2. **Research and write.** Give `profile-writer` the [writer prompt](../prompts/profile.md), [assessed Profile format](../prompts/profile-assessment.md), and Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json`. It reads supporting and competing evidence via `profiles evidence` (starting from `manifest_groups` and `dispute_source_ids` when present, using web search only as fallback), records material competing accounts as `counterevidence`, stages `data/raw/profiles/incoming/<QID>.json` with its serving model ID in `writer.model`, and runs `validate --qid=<QID>`.
3. **Validate and finalize.** Confirm `validate --qid=<QID>` passes before batching the QID into `finalize --qids=...` (pass `--model=<id>` only if a staged file omitted `writer.model`). Finalization writes the clean draft to `data/raw/profiles/<lane>/` and stores pending assessment state in `tasks/<QID>/pending.json`. For an existing finalized draft, check it with `validate --qid=<QID> --file=<raw Profile>`.
4. **Audit.** Run `english-audit --qid=<QID> --out=<audit task>`, dispatch `profile-auditor`, and apply the reply with `--result=<audit reply>`. `approved` and `skipped` can move to Russian.
5. **Repair when needed.** Run `english-repair --qid=<QID> --out=<repair task>` and dispatch `profile-writer`. It returns a compact JSON patch containing only changed passages (and optional drops or `subject_dates`), and runs `validate --qid=<QID> --file=<repair reply>` to validate the merged draft before returning. Apply with `english-repair --qid=<QID> --result=<repair reply>`, then repeat step 4 (the follow-up audit receives `re_audit` context focusing on resolved blockers and patched passages). Up to two draft changes are allowed; evidence-only replies use no draft repair round, and `edited` drafts refuse prose overwrites during repair.

### Russian

1. Run `russian-translation --qid=<QID> --out=<translation task>`. If it returns `skipped`, the saved translation is current. Otherwise dispatch `profile-translator` to write `ru-candidate.json` (either all fields or, after a hold, exactly the flagged replacement paths).
2. Run `russian-audit --qid=<QID> --candidate=<candidate> --out=<fidelity task>` to validate/merge the candidate and prepare the fidelity task. Dispatch `profile-translation-auditor`, then apply its reply with `--result=<audit reply>`.
3. If the first audit holds, repeat steps 1–2 once for a targeted correction and fresh full audit. If blockers remain, report the hold and retain the English approval.

### Reply envelope

Save every task reply with the task’s exact `input_hash` and actual serving model ID in `model`, supplying `reasoning_effort` and `tokens` when the runtime reports them:

```json
{"input_hash":"copy from task","model":"gpt-6.2-sol","reasoning_effort":null,"tokens":null,"result":{}}
```

Regenerate a task whenever its inputs change.

## Task files

Store per-QID task and reply files under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`:

| Command | Task | Reply |
|---|---|---|
| `prefetch --manifest` | — | `scout.json` |
| `english-audit` | `audit-task.json` | `audit-reply.json` |
| `english-repair` | `repair-task.json` | `repair-reply.json` |
| `russian-translation` | `ru-translation-task.json` | `ru-candidate.json` |
| `russian-audit` | `ru-audit-task.json` | `ru-audit-reply.json` |

## Finish the batch

Report per-QID English and Russian outcomes, next steps, blockers, and any prepared task paths. When publication is requested, run `build-data` and then `publish-data` once at batch end. [Publication](profiles.md#publication)
