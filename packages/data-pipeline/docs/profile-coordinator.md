# Profile coordinator

Give the coordinator the QIDs selected in chat, the requested outcome, and any provider or model choices. Run one batch at a time. Draft every new Profile using the subagent research-and-write step. Use subagents by default for the remaining steps and provider APIs for verification, audit or translation when explicitly requested.

For an existing draft, resume with its pending assessment or the assessment in its current verification report. Previously saved assessment files can be passed with `--research=<file>` to both `english-adversarial` and `english-audit`. For approved English, resume at Russian translation.

Use `npm run --silent profiles --workspace packages/data-pipeline -- <command>` for the commands below. If the `tsx` launcher is unavailable, use `node --import tsx packages/data-pipeline/src/profiles/index.ts <command>` from the repo root. Redirect the JSON from a command to a working file when it is the input to an agent.

## Subagent workflow

Dispatch each model task in a fresh context with its input and output paths. Keep a working directory outside the repository for agent responses. Call the CLI for prefetch, evidence, preflight, finalization and audit results.

### English

1. **Research and write.** Run `prefetch --qids=Q1,Q2,...` for the batch. Give the writing agent its [writer prompt](../prompts/profile.md), [assessed Profile format](../prompts/profile-assessment.md), and Source Map at `data/raw/profiles/evidence/prefetch/<QID>.json`. The map includes the subject brief, saved sources, heading offsets and skipped URLs. Use heading offsets with `evidence --url=<https URL> --offset=<number> --length=<chars>` or add `--query=<phrase>` to jump to a literal match. For new URLs, use `--outline` to see the page structure before reading excerpts. Seek further sources when the map has gaps. Preserve each cited final URL and use `next_offset` to read further. The agent stages one assessed Profile at `data/raw/profiles/incoming/<QID>.json`.
2. **Preflight and finalize.** Run `preflight --qid=<QID>` and resolve every reported issue before running `finalize --qids=<QID>`. The CLI extracts the draft and saves its pending assessment with it. When finalization drops Connections, it removes their findings and reindexes the remaining paths. For an existing finalized draft, use `preflight --qid=<QID> --file=<raw Profile>` to check its saved assessment before dispatch.
3. **Check high-risk claims.** Run `english-adversarial --qid=<QID>`. If it returns `skipped`, continue to the audit. Otherwise dispatch the task to a fresh agent with access to web search and the `evidence` command, then apply its reply with `english-adversarial --qid=<QID> --result=<adversarial reply>`. The CLI validates the quotes against cached snapshots and saves the checks for this draft and assessment.
4. **Audit.** Run `english-audit --qid=<QID>` to prepare a task. Give it to a fresh auditor, then rerun with `--result=<audit reply>` to apply the verdict. The audit task includes any new counterevidence and conflict or fetch notes. The CLI checks the saved snapshot text, citation URLs and anchors, QIDs, dates, markup, claim coverage, and audit issues before issuing a receipt. The verification report becomes the saved record of the assessment. `approved` and `skipped` can move to Russian. For failed source reads, try the fetch again or find a readable source.
5. **Repair when needed.** Run `english-repair --qid=<QID>` and give the task to a repair agent. It saves the full assessed Profile with changes to the flagged wording or evidence and runs `preflight --qid=<QID> --file=<repair reply>` before handing it back. Apply it with `english-repair --qid=<QID> --result=<repair reply>`. The CLI saves the draft and its pending assessment together. Repeat the adversarial and audit steps for the repaired assessment. Up to two draft changes are allowed. An evidence-only reply keeps the exact draft and uses no draft repair round. A draft change on a protected edit becomes a proposal for human review.

#### Writer's evidence check

The [writer prompt](../prompts/profile.md) includes the passage-by-passage evidence check. Use it before staging a draft and when revising passages. Record the excerpts, counterevidence and unresolved issues in the [assessed Profile format](../prompts/profile-assessment.md).

The independent auditor reviews the full Profile in one task, checking each passage in order against its evidence and any competing accounts before reviewing the whole narrative. During repair, verify proposed rewrites against complete source clauses. Check that the text and its finding agree on the actor, action and object. Reread every sentence in a touched passage against its evidence and finding, including sentences carried over verbatim. Reread passages that depend on it, then send the full repaired Profile to a fresh auditor.

In measured trials, record first-audit claim blockers, repair rounds and elapsed time. For each prose blocker found on re-audit, compare the original and revised wording. Record whether the repair introduced the issue or carried it forward, and whether the repair touched the passage. Record evidence classification and citation issues alongside the prose findings.

### Russian

1. Run `russian-translation --qid=<QID>`. If it returns `skipped`, the saved translation is current. Otherwise give its task to the translator and include the [fidelity review checks](profile-translation.md#fidelity-review) for comparing the Russian with English before and after polishing.
2. When the task lists paths to correct after a hold, save the translator's reply with exactly those fields. `russian-audit` merges the replacements into the held candidate and validates the complete translation. If the audit found a Profile-wide problem or its findings cannot be tied to specific fields, the translation task requests a complete candidate.
3. Run `russian-audit --qid=<QID> --candidate=<file>` to validate the complete candidate. Give the resulting task to a fresh auditor for a [full fidelity review](profile-translation.md#fidelity-review). Rerun the command with `--result=<audit reply>` to apply the verdict. If the first audit holds, repeat these steps for one correction and a fresh full audit. If blockers remain, report the hold and retain the English approval.

For a Russian-only retry, reuse the approved English source and citations. Compare the English Profile and verification file hashes before and after the run. Record elapsed time per Russian stage, the first audit verdict, the number of correction rounds after that audit, and the final approval or hold.

For any prepared task, pass the full task to its agent. Save responses in this form, supplying measured runtime metadata when available:

```json
{"input_hash":"copy from task","model":null,"reasoning_effort":null,"tokens":null,"result":{}}
```

The result follows the task prompt. Save it before applying it. Resume with the latest saved artifacts and regenerate a task if its inputs changed.

## Provider API workflow

The coordinator runs these commands directly. Pass the selected QIDs to every command and apply provider and model overrides only to the commands they configure. The CLI uses the [configured provider credentials](../../../docs/config-variables.md#profile-credentials) and records results in the same artifacts used by the subagent workflow.

| Requested outcome | Commands |
|---|---|
| Verify finalized English drafts | Run `verify --qids=…`. Include `--repair` if the task calls for repair. Verification also handles Russian translation and fidelity checks after English approval. |
| Compare English audits on saved evidence | Run `audit --qids=…` with the requested provider and model. Report the result alongside the saved audit. |
| Backfill or retry Russian | Run `translate --qids=…` for subjects with current English approval. |

Read the per-QID outcomes after each command. A batch can stage or approve some Profiles even when the command exits nonzero. Continue with the successful QIDs and report held or failed ones with the reason. See the [Profile CLI](profiles.md) for command flags.

## Finish the batch

Report the English and Russian outcomes, blockers, and any proposal path. Run [build and publish](profiles.md#publication) when the requested outcome includes publication.
