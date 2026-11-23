# Profile coordinator

Give the coordinator the QIDs selected in chat, the requested outcome, and any provider or model choices. Run one batch at a time. Draft every new Profile using the subagent research-and-write step. Use subagents by default for the remaining steps and provider APIs for verification, audit or translation when explicitly requested.

For an existing draft, resume with its saved assessment or obtain evidence for the saved text. For approved English, resume at Russian translation.

Use `npm run --silent profiles --workspace packages/data-pipeline -- <command>` for the commands below. If the `tsx` launcher is unavailable, use `node --import tsx packages/data-pipeline/src/profiles/index.ts <command>` from the repo root. Redirect the JSON from a command to a working file when it is the input to an agent.

## Subagent workflow

Dispatch each model task in a fresh context with its input and output paths. Keep a working directory outside the repository for agent responses. Call the CLI for evidence, finalization and audit results.

### English

1. **Research and write.** Give one agent the subject's QID, name, type, formatted dates, and Wikipedia URL from `loadSubjects()`, the [writer prompt](../prompts/profile.md), the assessment format in `RESEARCH_INSTRUCTIONS` in [researcher.ts](../src/profiles/verification/researcher.ts), and the [writer's evidence check](#writers-evidence-check) below. Have it discover sources, use `evidence --url=<https URL> [--query=<phrase>] [--offset=<number>]` to read excerpts, write the checked draft to `data/raw/profiles/incoming/<QID>.json`, and save `{"assessment": {...}, "model": ...}` in the working directory. Include `connection_urls` in the research file with the Connection Wikipedia URLs in draft order. Map claims to the final prose and use the returned source IDs and exact excerpts. The fetch command caches source text by URL, with `--refresh` available when a new snapshot is needed. Preserve the cited final URL and use `next_offset` to read further.
2. **Finalize.** Run `finalize --qids=<QID>` and check its outcome. Finalization may drop Connections. The audit command uses `connection_urls` to drop findings for removed Connections and align the remaining findings with the finalized draft.
3. **Audit.** Run `english-audit --qid=<QID> --research=<file>` to produce a task. Give it to a fresh auditor. Run the same command with `--result=<audit reply>` to apply the verdict. The CLI checks the saved snapshot text, citation URLs and anchors, QIDs, dates, markup, claim coverage, and audit issues before issuing a receipt. `approved` and `skipped` can move to Russian. For failed source reads, try the fetch again or find a readable source. For a held draft, address the blockers and audit again.
4. **Repair when needed.** Run `english-repair --qid=<QID>` to get the held draft and blockers. Give a repair agent that task and the assessment format. Have it return the repaired Profile in its task reply, update the research file for changed claims and recheck the citations for changed passages. Apply with `english-repair --qid=<QID> --result=<repair reply>`. The CLI saves a draft checkpoint and archives the prior report. It allows two repair rounds. A protected edit gets a proposal for human review. Audit each accepted repair with a fresh agent.

#### Writer's evidence check

Before staging the draft, read the final wording of every passage alongside its fetched excerpts. Include the overview, Key Moment dates and titles, Deep Facts, and Connection explanations. Split compound statements into individual claims and check what the evidence establishes for each one.

- **Dates and sequence.** Check which event each date describes. Keep ranges, approximate dates and calendar distinctions. A date for documented work on a painting supports work by that date. A claim about when the work began needs evidence of its start. Check any credible conflicting dates found during research.
- **Attribution and certainty.** Check who did, said or concluded what. Preserve uncertainty and identify the source when the evidence gives an attributed account. Keep the qualifications visible wherever a title, label or sentence makes the claim.
- **Cause and influence.** Check whether the excerpt establishes the direction and strength of the connection. If it establishes only that one person cited another's work, state that relationship. Claims of influence, motive or consequence need evidence for the link.
- **Passage citations.** For every Key Moment and Deep Fact, apply the writer prompt's source rules. Match its `source` URL to a source ID used with an exact excerpt in a `supported` finding for that same passage. Use the final URL returned by `evidence` after redirects. Add a section anchor only if the fetched page confirms it. Wikipedia is optional. Record any additional evidence in the assessment and apply the corroboration rules in `RESEARCH_INSTRUCTIONS` even when the passage has a strong citation.

If the wording overstates the evidence, fetch a more precise excerpt or revise the passage to match the support. Remove an unsupported optional detail if the passage still works without it. Record unresolved disputes or gaps in the assessment. For each date, attribution or causal claim, use the finding's `explanation` to state what the excerpt establishes for the final wording. Update the claims and findings after editing and check that they still cover every factual detail. Do this within the research-and-write task, then send the draft and assessment to the independent audit.

### Russian

1. Run `russian-translation --qid=<QID>`. If it returns `skipped`, the saved translation is current. Otherwise give its task to the translator. In the same task, have the translator compare every Russian field with its English source for fidelity, then reread the Russian for flow before saving the candidate.
2. When the task includes feedback from a hold, give the translator the full Profile and audit feedback for context and ask for revisions only to fields with blockers. The current CLI expects a complete candidate. In a temporary file, start with the held fields and merge only replacements for the flagged paths into the full reply with the current task hash. Verify the diff against the held fields.
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
