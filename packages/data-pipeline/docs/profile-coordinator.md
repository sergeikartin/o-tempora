# Profile coordinator

Give the coordinator the QIDs selected in chat and the requested outcome. Set concurrency to 1 by default. The caller can explicitly raise it to 2 or 3. Keep one active workflow per QID and store its prepared tasks and replies in gitignored `packages/data-pipeline/data/raw/profiles/tasks/<QID>/`. Pass that directory’s task and reply paths using the filenames in the [handoff playbook](profile-handoff.md#task-files).

Run `status --qids=Q1,Q2,...` at batch start and after a usage-window reset. Select the next incomplete QIDs and resume each at its `next_command`. Use `--stage=<stage1,stage2,...>` for a wave queue and `--limit=<n>` to cap the returned items and their summary counts. Check any saved replies before dispatching new work. For Russian, the CLI status reflects saved verdicts, so check the saved candidate and fidelity task when resuming an in-progress handoff. Use `--scope=legendary`, `--scope=mainstream` or `--scope=all` for dataset-wide inspection. The default covers Legendary and Mainstream People and Milestones. The Legendary scope covers those same lanes at the Legendary floor. The all scope includes Conflicts and deeper Detail Levels. Leave completed artifacts on disk when pausing. If an older draft lacks a current assessment, prepare its assessment from evidence and use the reported `--research` entry point.

For QIDs that need a Source Map, run `prefetch --qids=... --concurrency=<n>` once at the coordinator. It writes individual blocked-host cache entries under `evidence/blocked-hosts/` and keeps Wikipedia requests paced. Collect successfully preflighted QIDs and call `finalize --qids=...` as a coordinator batch.

For an existing draft, resume with its pending assessment or the assessment in its current verification report. Previously saved assessment files can be passed with `--research=<file>` to both `english-adversarial` and `english-audit`. For approved English, resume at Russian translation.

Use `npm run --silent profiles --workspace packages/data-pipeline -- <command>` for the commands below. If the `tsx` launcher is unavailable, use `node --import tsx packages/data-pipeline/src/profiles/index.ts <command>` from the repo root. Prepare task files with `--out=<file>`. The CLI creates parent directories and prints the saved path and input hash when a task is prepared. With `--result=<file>`, the CLI applies the saved reply. Resolve paths from the command’s working directory. npm workspace scripts run from `packages/data-pipeline`, and the direct Node command uses the directory it is called from.

## Wave boundaries

`stop_after` is a chat instruction to the coordinator. Stop at the requested boundary for each QID and report its latest stage, any blocker, and the paths available for the next wave. Prepare the next task where the table calls for it, then leave the task for the next session.

| `stop_after` | Checkpoint |
|---|---|
| `finalize` | Prefetch, write, preflight and finalize. Prepare `audit-task.json` only if the finalized draft is already at `draft-pending-audit`. |
| `english-adversarial` | Apply the counterevidence reply, or accept the CLI’s `skipped` or `reused` outcome. Prepare `audit-task.json`. |
| `english-audit` | Apply the English verdict and report `english-approved` or `english-held`. |
| `english-repair` | Apply the repair and save the updated draft and assessment, or report the protected edit’s proposal or other blocker. Prepare a fresh `audit-task.json` when the resulting stage is `draft-pending-audit`. If adversarial checks are pending, report that as the next wave. |
| `russian-translation` | Save `ru-candidate.json` and prepare `ru-audit-task.json` from it. If translation is already current, report `bilingual-approved`. |
| `russian-audit` | Apply the fidelity verdict and report `bilingual-approved` or `russian-held`. |

## Subagent workflow

Dispatch each model task in a fresh context with its input and output paths. If a stateless Codex role lacks local file tools, pass the complete prepared task and any referenced local instructions in its message, then save its returned JSON yourself. Call the CLI for prefetch, evidence, preflight, finalization and audit results.

### English

1. **Research and write.** Give `profile-writer` its [writer prompt](../prompts/profile.md), [assessed Profile format](../prompts/profile-assessment.md), and Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json`. The map includes the subject brief, saved sources, heading offsets and skipped URLs. Use heading offsets with `evidence --url=<https URL> --offset=<number> --length=<chars>` or add `--query=<phrase>` to jump to a literal match. For new URLs, use `--outline` to see the page structure before reading excerpts. Seek further sources when the map has gaps. Preserve each cited final URL and use `next_offset` to read further. The agent stages one assessed Profile at `data/raw/profiles/incoming/<QID>.json` with its actual serving model ID in `writer.model`. Use `finalize --model=<id>` for a missing staged writer model when you know the model used.
2. **Preflight and finalize.** Run `preflight --qid=<QID>` and resolve every reported issue before batching the QID for finalization. The CLI extracts the draft and saves its pending assessment with it. When finalization drops Connections, it removes their findings and reindexes the remaining paths. For an existing finalized draft, use `preflight --qid=<QID> --file=<raw Profile>` to check its saved assessment before dispatch.
3. **Check high-risk claims.** Run `english-adversarial --qid=<QID> --out=<adversarial task>`. If it returns `skipped` or `reused`, continue to the audit. Otherwise dispatch the task to `profile-adversarial` with access to web search and the `evidence` command, then apply its reply with `english-adversarial --qid=<QID> --result=<adversarial reply>`. The CLI validates the quotes against cached snapshots and saves the checks for this draft and assessment.
4. **Audit.** Run `english-audit --qid=<QID> --out=<audit task>`. Give it to `profile-auditor`, then use `--result=<audit reply>` in place of `--out` to apply the verdict. The audit task includes any new counterevidence and conflict or fetch notes. The CLI checks the saved snapshot text, citation URLs and anchors, QIDs, dates, markup, claim coverage, and audit issues before issuing a receipt. The verification report becomes the saved record of the assessment. `approved` and `skipped` can move to Russian. For failed source reads, try the fetch again or find a readable source.
5. **Repair when needed.** Run `english-repair --qid=<QID> --out=<repair task>` and give the task to `profile-writer`. It saves the full assessed Profile with changes to the flagged wording or evidence and runs `preflight --qid=<QID> --file=<repair reply>` before handing it back. Apply it with `english-repair --qid=<QID> --result=<repair reply>`. The CLI saves the draft and its pending assessment together. Repeat the adversarial and audit steps for the repaired assessment. Previously checked claims are reused when their passage paths and claim text match and their counterevidence remains valid. Up to two draft changes are allowed. An evidence-only reply keeps the exact draft and uses no draft repair round. A draft change on a protected edit becomes a proposal for human review.

#### Writer's evidence check

The [writer prompt](../prompts/profile.md) includes the passage-by-passage evidence check. Use it before staging a draft and when revising passages. Record the excerpts, counterevidence and unresolved issues in the [assessed Profile format](../prompts/profile-assessment.md).

The independent auditor reviews the full Profile in one task, checking each passage in order against its evidence and any competing accounts before reviewing the whole narrative. During repair, verify proposed rewrites against complete source clauses. Check that the text and its finding agree on the actor, action and object. Reread every sentence in a touched passage against its evidence and finding, including sentences carried over verbatim. Reread passages that depend on it, then send the full repaired Profile to a fresh auditor.

In measured trials, record first-audit claim blockers, repair rounds and elapsed time. For each prose blocker found on re-audit, compare the original and revised wording. Record whether the repair introduced the issue or carried it forward, and whether the repair touched the passage. Record evidence classification and citation issues alongside the prose findings.

### Russian

1. Run `russian-translation --qid=<QID> --out=<translation task>`. If it returns `skipped`, the saved translation is current. Otherwise give its task to `profile-translator` and include the [fidelity review checks](profile-translation.md#fidelity-review) for comparing the Russian with English before and after polishing.
2. When the task lists paths to correct after a hold, save the translator's reply with exactly those fields. `russian-audit` merges the replacements into the held candidate and validates the complete translation. If the audit found a Profile-wide problem or its findings cannot be tied to specific fields, the translation task requests a complete candidate.
3. Run `russian-audit --qid=<QID> --candidate=<file> --out=<fidelity task>` to validate the complete candidate. Give the resulting task to `profile-translation-auditor` for a [full fidelity review](profile-translation.md#fidelity-review). Use the same candidate with `--result=<audit reply>` in place of `--out` to apply the verdict. If the first audit holds, repeat these steps for one correction and a fresh full audit. If blockers remain, report the hold and retain the English approval.

For a Russian-only retry, reuse the approved English source and citations. Compare the English Profile and verification file hashes before and after the run. Record elapsed time per Russian stage, the first audit verdict, the number of correction rounds after that audit, and the final approval or hold.

Pass the full prepared task to its agent. Save the reply with the task’s exact `input_hash` and the actual serving model ID in `model`. Supply `reasoning_effort` and `tokens` when the runtime reports them.

```json
{"input_hash":"copy from task","model":"gpt-6.2-sol","reasoning_effort":null,"tokens":null,"result":{}}
```

The result follows the task prompt. Save it before applying it. Resume with the latest saved artifacts and regenerate a task if its inputs changed.

## Finish the batch

Report the English and Russian outcomes, blockers, and any proposal path. When publication is requested, run `build-data` and then `publish-data` once at batch end. [Publication](profiles.md#publication)
