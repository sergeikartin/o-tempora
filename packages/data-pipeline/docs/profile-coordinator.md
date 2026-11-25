# Profile coordinator

Give the coordinator the QIDs selected in chat and the requested outcome. Set concurrency to 1 by default. The caller can explicitly raise it to 2 or 3. Keep one active workflow per QID and store its prepared tasks and replies in gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`. Use the filenames in the [handoff playbook](profile-handoff.md#task-files).

Run `status --qids=Q1,Q2,...` at batch start and after a usage-window reset. Select the next incomplete QIDs and resume each at its `next_command`. Use `--stage=<stage1,stage2,...>` for a wave queue and `--limit=<n>` to cap the returned items and their summary counts. Check saved replies before dispatching new work; for Russian, check `ru-candidate.json` and `ru-audit-task.json` when resuming an in-progress handoff. Use `--scope=legendary`, `--scope=mainstream` or `--scope=all` for dataset-wide inspection (default: Legendary and Mainstream People and Milestones). Leave completed artifacts on disk when pausing.

For QIDs needing a Source Map, dispatch `profile-scout` to write `tasks/<QID>/scout.json` and run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json` (or fall back to `prefetch --qids=... --concurrency=<n>` without a manifest). Batch preflighted QIDs into `finalize --qids=...`. For an existing draft without a current pending assessment, resume from its verification report or pass a saved assessment file with `--research=<file>` to `english-adversarial` and `english-audit`. For approved English, resume at Russian translation.

Use `npm run --silent profiles --workspace packages/data-pipeline -- <command>` (or `node --import tsx packages/data-pipeline/src/profiles/index.ts <command>` from the repo root if `tsx` IPC is unavailable). Prepare task files with `--out=<file>` and apply saved replies with `--result=<file>`. Resolve relative paths from the command’s working directory (`packages/data-pipeline` under npm workspaces, or the current directory for direct `node`).

## Wave boundaries

`stop_after` is a chat instruction to the coordinator. Stop at the requested boundary for each QID, prepare the next task where called for, and report the latest stage, any blocker, and available handoff paths.

| `stop_after` | Checkpoint |
|---|---|
| `finalize` | Prefetch, write, preflight and finalize. Prepare `audit-task.json` only if the finalized draft is already at `draft-pending-audit`. |
| `english-adversarial` | Apply the counterevidence reply, or accept `skipped` or `reused`. Prepare `audit-task.json`. |
| `english-audit` | Apply the English verdict and report `english-approved` or `english-held`. |
| `english-repair` | Apply the repair and save the updated draft and assessment, or report a protected edit’s proposal or other blocker. Prepare a fresh `audit-task.json` when the resulting stage is `draft-pending-audit`; otherwise report `draft-pending-adversarial` as the next wave. |
| `russian-translation` | Save `ru-candidate.json` and prepare `ru-audit-task.json` from it. If translation is already current, report `bilingual-approved`. |
| `russian-audit` | Apply the fidelity verdict and report `bilingual-approved` or `russian-held`. |

## Subagent workflow

Dispatch each model task in a fresh context with its exact input and output paths. If a stateless Codex role lacks local file tools, pass the complete prepared task in its message and save its returned JSON yourself. Policy, corroboration, and receipt rules live in [verification](profile-verification.md) and [translation](profile-translation.md).

### English

1. **Scout and prefetch.** Dispatch `profile-scout` to save `tasks/<QID>/scout.json` (`core_urls`, paired `deep_fact_candidates`, `dispute_urls`), then run `prefetch --qids=<QID> --manifest=tasks/<QID>/scout.json`. The resulting Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json` caches Wikipedia plus the manifest URLs and annotates each Deep Fact candidate with `corroboration_ready`.
2. **Research and write.** Give `profile-writer` the [writer prompt](../prompts/profile.md), [assessed Profile format](../prompts/profile-assessment.md), and Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json`. It reads evidence via `profiles evidence` (starting from `manifest_groups` when present, using web search only as fallback), stages `data/raw/profiles/incoming/<QID>.json` with its serving model ID in `writer.model`, and runs `preflight --qid=<QID>`.
3. **Preflight and finalize.** Confirm `preflight --qid=<QID>` passes before batching the QID into `finalize --qids=...` (pass `--model=<id>` only if a staged file omitted `writer.model`). For an existing finalized draft, check it with `preflight --qid=<QID> --file=<raw Profile>`.
4. **Check high-risk claims.** Run `english-adversarial --qid=<QID> --out=<adversarial task>`. If it returns `skipped` or `reused`, continue to audit. Otherwise dispatch `profile-adversarial` and apply its reply with `english-adversarial --qid=<QID> --result=<adversarial reply>`.
5. **Audit.** Run `english-audit --qid=<QID> --out=<audit task>`, dispatch `profile-auditor`, and apply the reply with `--result=<audit reply>`. `approved` and `skipped` can move to Russian.
6. **Repair when needed.** Run `english-repair --qid=<QID> --out=<repair task>` and dispatch `profile-writer`. It returns a compact JSON patch containing only changed passages (and optional drops or `subject_dates`), and runs `preflight --qid=<QID> --file=<repair reply>` to validate the merged draft before returning. Apply with `english-repair --qid=<QID> --result=<repair reply>`, then repeat steps 4–5 (prior adversarial checks reuse automatically when no new risk cue, long quote, or number is introduced, and the follow-up audit receives `re_audit` context focusing on resolved blockers and patched passages). Up to two draft changes are allowed; evidence-only replies use no draft repair round, and changes to protected `edited` drafts become proposals.

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

## Finish the batch

Report per-QID English and Russian outcomes, blockers, handoff paths, and any proposal path. When publication is requested, run `build-data` and then `publish-data` once at batch end. [Publication](profiles.md#publication)
