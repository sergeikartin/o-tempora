# Profile coordinator (English)

Coordinates English Profile authoring, verification, and repair for QIDs selected in chat. Russian translation runs independently through the [Profile translation coordinator](profile-translation-coordinator.md) once English Profiles are approved.

Give the coordinator the QIDs selected in chat and the requested outcome. Set concurrency to 1 by default. The caller can explicitly raise it to 2 or 3; when processing multiple QIDs, pipeline scout/prefetch for the next QID while the current QID is in audit. Keep one active English workflow per QID and store its prepared tasks and replies in gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/` using the [task filenames](#task-files) below.

Run `status --qids=Q1,Q2,...` at batch start and after a usage-window reset. Select the next incomplete QIDs and resume each at its `next_command`. Use `--stage=<stage1,stage2,...>` for a wave queue (`missing`, `staged`, `draft-pending-audit`, `english-held`, `english-approved`) and `--limit=<n>` to cap the returned items and their summary counts. Check saved replies before dispatching new work. Use `--scope=legendary`, `--scope=mainstream` or `--scope=all` for dataset-wide inspection (default: Legendary and Mainstream People and Milestones). Leave completed artifacts on disk when pausing.

For QIDs needing a Source Map, dispatch `profile-scout` to write `tasks/<QID>/scout.json` and run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json` (or fall back to `prefetch --qids=... --concurrency=<n>` without a manifest). Batch validated QIDs into `finalize --qids=...`. For an existing draft without a current pending assessment, resume from its verification report. Stop at `english-approved` (`next_command: done`).

Run `NODE_USE_ENV_PROXY=1 node packages/data-pipeline/src/profiles/index.ts <command>` from the repo root (or `npm run --silent profiles --workspace packages/data-pipeline -- <command>`). Prepare task files with `--out=<file>` and apply saved replies with `--result=<file>`. Resolve relative paths from the command’s working directory (the current directory for direct `node`, or `packages/data-pipeline` under npm workspaces).

## Wave boundaries

`stop_after` is a chat instruction to the coordinator. Stop at the requested boundary for each QID, prepare the next task where called for, and report the latest stage, any blocker, and available task paths.

| `stop_after` | Checkpoint |
|---|---|
| `finalize` | Scout, prefetch, write, validate, finalize, and prepare `audit-task.json`. |
| `english-audit` | Apply the English verdict and report `english-approved` or `english-held`. |
| `english-repair` | Apply the repair, save the updated draft and `tasks/<QID>/pending.json`, and prepare a fresh `audit-task.json` (or report any blocker). |

## Subagent workflow

Dispatch each model task in a fresh context with its exact input and output paths, and confirm each subagent’s serving model ID for provenance. Canonical English worker instructions live in `packages/data-pipeline/docs/profile-roles/` ([`profile-scout.md`](profile-roles/profile-scout.md), [`profile-writer.md`](profile-roles/profile-writer.md), [`profile-auditor.md`](profile-roles/profile-auditor.md)); thin harness stubs in `.claude/agents/`, `.codex/agents/`, and `.agents/agents/` point here and to those files. If a stateless Codex role lacks local file tools, pass its role instructions and the complete prepared task in its message and save its returned JSON yourself. Policy, corroboration, and receipt rules live in [verification](profile-verification.md).

1. **Scout and prefetch.** Dispatch `profile-scout` to run neutral and falsification searches and save `tasks/<QID>/scout.json` (`core_urls`, paired `deep_fact_candidates` with optional `dispute_urls`, and `dispute_urls`), then run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json`. The resulting Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json` caches Wikipedia plus the manifest URLs and annotates each Deep Fact candidate with `dispute_source_ids` and `corroboration_ready`.
2. **Research and write.** Give `profile-writer` the [writer prompt](../prompts/profile.md), [assessed Profile format](../prompts/profile-assessment.md), and Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json`. It reads supporting and competing evidence via `profiles evidence` (starting from `manifest_groups` and `dispute_source_ids` when present, using web search only as fallback), records material competing accounts as `counterevidence`, stages `data/raw/profiles/incoming/<QID>.json` with its serving model ID in `writer.model`, and runs `validate --qid=<QID>`.
3. **Validate and finalize.** Confirm `validate --qid=<QID>` passes before batching the QID into `finalize --qids=...` (pass `--model=<id>` only if a staged file omitted `writer.model`). Finalization writes the clean draft to `data/raw/profiles/<lane>/` and stores pending assessment state in `tasks/<QID>/pending.json`. For an existing finalized draft, check it with `validate --qid=<QID> --file=<raw Profile>`.
4. **Audit.** Run `english-audit --qid=<QID> --out=<audit task>`, dispatch `profile-auditor`, and apply the reply with `--result=<audit reply>`. `approved` and `skipped` complete the English workflow for that QID.
5. **Repair when needed.** Run `english-repair --qid=<QID> --out=<repair task>` and dispatch `profile-writer`. It returns a compact JSON patch containing only changed passages (and optional drops or `subject_dates`), and runs `validate --qid=<QID> --file=<repair reply>` to validate the merged draft before returning. Apply with `english-repair --qid=<QID> --result=<repair reply>`, then repeat step 4 (the follow-up audit receives `re_audit` context focusing on resolved blockers and patched passages). Up to two draft changes are allowed; evidence-only replies use no draft repair round, and `edited` drafts refuse prose overwrites during repair.

### Reply envelope

Save every task reply with the task’s exact `input_hash` and actual serving model ID in `model`, supplying `reasoning_effort` and `tokens` when the runtime reports them:

```json
{"input_hash":"copy from task","model":"gpt-6.2-sol","reasoning_effort":null,"tokens":null,"result":{}}
```

Regenerate a task whenever its inputs change.

## Task files

Store per-QID English task and reply files under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`:

| Command | Task | Reply |
|---|---|---|
| `prefetch --manifest` | — | `scout.json` |
| `english-audit` | `audit-task.json` | `audit-reply.json` |
| `english-repair` | `repair-task.json` | `repair-reply.json` |

## Finish the batch

Report per-QID English outcomes (`english-approved` or `english-held`), next steps, blockers, and any prepared task paths. When publication is requested, run `build-data` and then `publish-data` once at batch end. [Publication](profiles.md#publication)
