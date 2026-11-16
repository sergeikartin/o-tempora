# Profile pipeline

A Profile gives one Person, Conflict or Milestone an overview, Key Moments, up to three Deep Facts and Connections to other dataset entities. It replaces the Wikipedia Description in the detail panel when available.

## From draft to publication

1. **Choose subjects.** Select a batch by Wikidata IDs (QIDs). Planning identifies which Profiles need writing and supplies their names, dates and Wikipedia URLs.
2. **Write from model knowledge.** An agent or provider API produces the prose, suggested claims and sources. These are unverified drafts; a confident answer does not grant approval.
3. **Finalize drafts.** Validate the structure and subject identity, resolve Connection URLs to QIDs, remove Connections outside the dataset and save generation metadata.
4. **Verify against fetched evidence.** Discover sources with web search, fetch their text and check claims from every visible field. A separate model call audits coverage, evidence, neutrality and narrative substance.
5. **Repair or hold.** Optional repair can correct supported wording or remove unsupported optional material, followed by verification again, at most twice. Unresolved Profiles are withheld. Human-edited prose is protected; proposed repairs require human application and reverification.
6. **Build and publish.** Output accepts only Profiles with approval bound to the current policy, exact content and verification report, with subject dates matching the current dataset. Publishing copies the static files into `shared-types`. The web app loads a Profile when its panel opens; absent or failed loads keep the Description fallback.

Humans audit a varied sample of approvals and resolve essential factual or framing disagreements. See [verification policy and review workflow](profile-verification.md) for evidence requirements, outcomes and protected edits.

## Commands and files

Writing and verification run offline, outside `build-data`. All Profile commands below run from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

`write` and `verify` default to provider API calls. Add `--execution=session --session-dir=<absolute directory>` to have the active conversation dispatch subagents for every model task, without provider API keys. See the [session workflow and subagent contract](profile-sessions.md).

| Command | Behavior |
|---|---|
| `plan --qids=Q1,Q2` | Prints writer inputs and staging paths for the chosen batch. |
| `write --qids=Q1,Q2` | Calls a provider, validates replies and stages `incoming/<QID>.json`. |
| `finalize` | Resolves subject and Connection QIDs, removes Connections outside the dataset, adds metadata, writes drafts and removes successfully finalized staging files. |
| `verify --qids=Q1,Q2 --repair` | Checks sources, audits claims, repairs up to twice and approves only passing content. See [verification](profile-verification.md). |

`plan` and `write` skip current-prompt records, stale records unless `--regenerate-stale` is set, and all `edited` records. Regeneration resets approval to `draft`; edited prose is protected. A `profile-writer` agent can stage the same JSON without an API key.

API writing accepts `--provider=openai|anthropic|gemini`, `--model=<id>` and `--concurrency=<n>` (default 3). Defaults live in `src/profiles/providers.ts`; credentials are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`. A failed item is reported without stopping the batch. `finalize --run-id=<id>` groups generated records; it preserves the served writer model and token counts. API writing stages a `generation` block containing `prompt_version`, `prompt_hash` and `generated_at` from the prompt actually used. Finalization copies these values without reading the current prompt. Agent or older staging files without this block receive null provenance; planning treats an unknown prompt hash as stale. An agent can supply the same block when its generation provenance is known.

Writer metadata records `reasoning_effort` and `tokens: {input, output}` when known. API writers record their configured effort; session writers receive effort and usage from runtime metadata through the coordinator. Session counts cover the writer agent's task including tool turns, rather than the full verification/repair pipeline. Missing metadata remains null; cached input and reasoning output are included in their respective totals when the runtime counts them there.

Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian files carry the English Profile whole. No provider or source calls happen during Output or in the web app.
