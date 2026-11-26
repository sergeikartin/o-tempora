# Profile translation coordinator (Russian)

Coordinates Russian translation and fidelity audits for current approved English Profiles. English authoring, verification, and repair run independently through the [Profile coordinator](profile-coordinator.md); this coordinator never modifies English drafts or verification reports.

Give the coordinator either explicit QIDs or a scope/stage wave (for example, all untranslated approved English Profiles). Set concurrency to 1 by default; the caller can raise it to 2 or 3. Keep one active translation workflow per QID and store prepared tasks and replies in gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/` using the [task filenames](#task-files) below.

Run `translation-status` at batch start and after a usage-window reset:
- `translation-status --qids=Q1,Q2,...` inspects explicit QIDs and reports `awaiting-english`, `missing`, `held`, or `approved`. Skip any `awaiting-english` QID and report its reason.
- `translation-status [--scope=all|legendary|mainstream] [--stage=missing,held,...] [--limit=<n>]` scans approved English Profiles (default `--scope=all`, covering People, Milestones, and Conflicts). `awaiting-english` is omitted in scope mode unless explicitly included in `--stage`.

Check saved `ru-candidate.json` and `ru-audit-task.json` before dispatching new work when resuming an in-progress QID. Leave completed artifacts on disk when pausing.

Run `NODE_USE_ENV_PROXY=1 node packages/data-pipeline/src/profiles/index.ts <command>` from the repo root (or `npm run --silent profiles --workspace packages/data-pipeline -- <command>`). Prepare task files with `--out=<file>` and apply saved replies with `--result=<file>`. Resolve relative paths from the command’s working directory (the current directory for direct `node`, or `packages/data-pipeline` under npm workspaces).

## Wave boundaries

`stop_after` is a chat instruction to the coordinator. Stop at the requested boundary for each QID, prepare the next task where called for, and report the latest stage, any blocker, and available task paths.

| `stop_after` | Checkpoint |
|---|---|
| `russian-translation` | Save `ru-candidate.json` and prepare `ru-audit-task.json` from it. If translation is already current (`skipped`), report `approved`. |
| `russian-audit` | Apply the fidelity verdict and report `approved` or `held`. |

## Subagent workflow

Dispatch each model task in a fresh context with its exact input and output paths, and confirm each subagent’s serving model ID for provenance. Canonical Russian worker instructions live in `packages/data-pipeline/docs/profile-roles/` ([`profile-translator.md`](profile-roles/profile-translator.md), [`profile-translation-auditor.md`](profile-roles/profile-translation-auditor.md)); thin harness stubs in `.claude/agents/`, `.codex/agents/`, and `.agents/agents/` point here and to those files. If a stateless Codex role lacks local file tools, pass its role instructions and the complete prepared task in its message and save its returned JSON yourself. Policy, glossary, and fidelity rules live in [translation](profile-translation.md).

1. **Translate or prepare targeted correction.** Run `russian-translation --qid=<QID> --out=<translation task>`. If it returns `skipped`, the saved translation is current. Otherwise dispatch `profile-translator` to write `ru-candidate.json` (either all fields or, after a hold, exactly the flagged replacement paths).
2. **Audit fidelity.** Run `russian-audit --qid=<QID> --candidate=<candidate> --out=<fidelity task>` to validate/merge the candidate and prepare the fidelity task. Dispatch `profile-translation-auditor`, then apply its reply with `--result=<audit reply>`.
3. **One correction pass on hold.** If the first audit holds, repeat steps 1–2 once for a targeted correction and fresh full audit. If blockers remain, report `held` (the English approval remains intact and publishable).

### Reply envelope

Save every task reply with the task’s exact `input_hash` and actual serving model ID in `model`, supplying `reasoning_effort` and `tokens` when the runtime reports them:

```json
{"input_hash":"copy from task","model":"gpt-6.2-sol","reasoning_effort":null,"tokens":null,"result":{}}
```

Regenerate a task whenever its inputs change.

## Task files

Store per-QID Russian task and reply files under gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`:

| Command | Task | Reply |
|---|---|---|
| `russian-translation` | `ru-translation-task.json` | `ru-candidate.json` |
| `russian-audit` | `ru-audit-task.json` | `ru-audit-reply.json` |

## Finish the batch

Report per-QID Russian outcomes (`approved`, `held`, or `awaiting-english`), next steps, blockers, and any prepared task paths. When publication is requested, run `build-data` and then `publish-data` once at batch end. [Publication](profiles.md#publication)
