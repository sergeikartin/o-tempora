# Profile pipeline

A Profile replaces the Wikipedia Description with an overview, Key Moments, up to three Deep Facts and Connections to other entities. The web app loads it on demand and uses the Description if loading fails.

## Workflow

Writing and verification run separately from `build-data`. Run these commands from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

`write` and `verify` default to provider API calls. Add `--execution=session --session-dir=<absolute directory>` to have the active conversation dispatch subagents for every model task, without provider API keys. See the [session workflow and subagent contract](profile-sessions.md).

The [Profile model routing module](../src/profiles/model-routing.ts) owns provider defaults, model overrides and API or session selection for `write`, `verify`, `audit` and `translate`.

| Command | Behavior |
|---|---|
| `plan --qids=Q1,Q2` | Prints writer inputs and staging paths for the chosen batch. |
| `write --qids=Q1,Q2` | Writes from model knowledge, validates the draft and stages it with suggested claims and sources in `incoming/<QID>.json`. |
| `finalize` | Resolves subject and Connection QIDs, removes Connections outside the dataset, adds metadata, writes drafts and removes successfully finalized staging files. |
| `verify --qids=Q1,Q2 --repair` | Checks every visible field against fetched evidence, audits the result and can repair up to twice. It withholds unresolved content and translates approved English. See [verification and human review](profile-verification.md). |
| `audit --qids=Q1,Q2` | Runs an independent audit against saved verification evidence and prints results and token usage for comparison. See [comparing auditors](profile-verification.md#compare-auditors-on-saved-evidence). |
| `translate --qids=Q1,Q2` | Translates currently approved English Profiles into Russian and separately audits fidelity. Skips current translations. |

`plan` and `write` skip current-prompt records and protect all `edited` records. Use `--regenerate-stale` to regenerate stale records and reset their approval to `draft`. A `profile-writer` agent can stage the same JSON without an API key.

## Writer provenance

API writing accepts `--provider=openai|anthropic|gemini`, `--model=<id>` and `--concurrency=<n>` (default 3). A failed item leaves the rest of the batch running. [Credentials](../../../docs/config-variables.md#profile-credentials)

`finalize --run-id=<id>` groups records and preserves the served model and staged prompt provenance. API writers stage `generation` with `prompt_version`, `prompt_hash` and `generated_at` from the prompt they used. Agents can supply those fields when known. Missing values stay null and planning treats an unknown prompt hash as stale.

Writer metadata stores `reasoning_effort` and `tokens: {input, output}` when known. API writers record their configured effort. Session metadata comes from the writer task’s runtime, including tool turns. Keep unknown values null. [Session accounting](profile-sessions.md#conversation-coordinator)

## Publication

Output accepts English Profiles with current hash-bound approval, matching subject dates and review status `reviewed` or `edited`. Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports and `*.ru.translation.json` artifacts. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian Profiles require a current approved translation. Only locales with a shipped Profile get `hasProfile`. Output and the web app read saved files. [Translation workflow](profile-translation.md)
