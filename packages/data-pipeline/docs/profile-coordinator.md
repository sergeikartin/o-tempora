# Profile coordinator

Give the coordinator the QIDs selected in chat, the requested outcome, and any provider or model choices. Run one batch at a time. Use the subagent workflow by default. Use the provider API workflow when the task explicitly requests API execution.

For an existing draft, resume with its saved assessment or obtain evidence for the saved text. For approved English, resume at Russian translation.

Use `npm run --silent profiles --workspace packages/data-pipeline -- <command>` for the commands below. If the `tsx` launcher is unavailable, use `node --import tsx packages/data-pipeline/src/profiles/index.ts <command>` from the repo root. Redirect the JSON from a command to a working file when it is the input to an agent.

## Subagent workflow

Dispatch each model task in a fresh context with its input and output paths. Keep a working directory outside the repository for agent responses. Call the CLI for evidence, finalization and audit results.

### English

1. **Research and write.** Give one agent the subject's QID, name, type, formatted dates, and Wikipedia URL from `loadSubjects()`, the [writer prompt](../prompts/profile.md), and the assessment format in `RESEARCH_INSTRUCTIONS` in [researcher.ts](../src/profiles/verification/researcher.ts). Have it discover sources, use `evidence --url=<https URL> [--query=<phrase>] [--offset=<number>]` to read excerpts, write the draft to `data/raw/profiles/incoming/<QID>.json`, and save `{"assessment": {...}, "model": ...}` in the working directory. Include `connection_urls` in the research file with the Connection Wikipedia URLs in draft order. Map claims to the final prose and use the returned source IDs and exact excerpts. The fetch command caches source text by URL, with `--refresh` available when a new snapshot is needed. Preserve the cited final URL and use `next_offset` to read further.
2. **Finalize.** Run `finalize --qids=<QID>` and check its outcome. Finalization may drop Connections. The audit command uses `connection_urls` to drop findings for removed Connections and align the remaining findings with the finalized draft.
3. **Audit.** Run `english-audit --qid=<QID> --research=<file>` to produce a task. Give it to a fresh auditor. Run the same command with `--result=<audit reply>` to apply the verdict. The CLI checks the saved snapshot text, citation URLs and anchors, QIDs, dates, markup, claim coverage, and audit issues before issuing a receipt. `approved` and `skipped` can move to Russian. For failed source reads, try the fetch again or find a readable source. For a held draft, address the blockers and audit again.
4. **Repair when needed.** Run `english-repair --qid=<QID>` to get the held draft and blockers. Give a repair agent that task and the assessment format. Have it return the repaired Profile in its task reply and update the research file for the changed claims. Apply with `english-repair --qid=<QID> --result=<repair reply>`. The CLI saves a draft checkpoint and archives the prior report. It allows two repair rounds. A protected edit gets a proposal for human review. Audit each accepted repair with a fresh agent.

### Russian

1. Run `russian-translation --qid=<QID>`. If it returns `skipped`, the saved translation is current. Otherwise give its task to the translator and save the candidate reply.
2. Run `russian-audit --qid=<QID> --candidate=<translation reply>`. Give the resulting task to a fresh fidelity auditor, then rerun with `--result=<audit reply>` to apply it. If held, run the translation command again. It includes the audit feedback for one correction and a full re-audit. If issues remain after that, report the hold and retain the English approval.

For any prepared task, pass the full task to its agent. Save responses in this form, supplying measured runtime metadata when available:

```json
{"input_hash":"copy from task","model":null,"reasoning_effort":null,"tokens":null,"result":{}}
```

The result follows the task prompt. Save it before applying it. Resume with the latest saved artifacts and regenerate a task if its inputs changed.

## Provider API workflow

The coordinator runs these commands directly. Pass the selected QIDs to every command and apply provider and model overrides only to the commands they configure. The CLI uses the [configured provider credentials](../../../docs/config-variables.md#profile-credentials) and records results in the same artifacts used by the subagent workflow.

| Requested outcome | Commands |
|---|---|
| Bilingual Profiles from scratch | Run `write --qids=…`, then `finalize --qids=…` for the staged drafts, then `verify --qids=… --repair` for the finalized drafts and any existing drafts being resumed. Verification also handles Russian translation and fidelity checks after English approval. |
| Verify existing English drafts | Run `verify --qids=…`. Include `--repair` if the task calls for repair. |
| Compare English audits on saved evidence | Run `audit --qids=…` with the requested provider and model. Report the result alongside the saved audit. |
| Backfill or retry Russian | Run `translate --qids=…` for subjects with current English approval. |

Read the per-QID outcomes after each command. A batch can stage or approve some Profiles even when the command exits nonzero. Continue with the successful QIDs and report held or failed ones with the reason. See the [Profile CLI](profiles.md) for command flags.

## Finish the batch

Report the English and Russian outcomes, blockers, and any proposal path. Run [build and publish](profiles.md#publication) when the requested outcome includes publication.
