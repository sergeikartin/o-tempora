# Profile pipeline

A Profile replaces the Wikipedia Description with an overview, Key Moments, up to three Deep Facts and Connections to other entities. The web app loads it on demand and uses the Description if loading fails.

## Workflow

Writing and verification run separately from `build-data`. Run these commands from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

Give the [Profile coordinator](profile-coordinator.md) the QIDs selected in chat and the requested outcome. A research-and-write agent fetches evidence before drafting, then stages one assessed Profile in `incoming/<QID>.json`. Finalization extracts the draft and saves its matching assessment for the independent audit. The coordinator runs `verify`, `audit` and `translate` when provider API execution is requested for those steps.

The [Profile model routing module](../src/profiles/model-routing.ts) owns provider defaults and model overrides for verification, audit and translation.

The prompts for [writing](../prompts/profile.md), [verification research](../prompts/profile-research.md), [English audit](../prompts/profile-audit.md), [English repair](../prompts/profile-repair.md), [Russian translation](../prompts/profile-translation.md), [translation repair](../prompts/profile-translation-repair.md) and [translation audit](../prompts/profile-translation-audit.md) live in `prompts/`. The [assessed Profile format](../prompts/profile-assessment.md) is shared by the writer and the [coordinator repair agent](../prompts/profile-assessment-repair.md). Each file records its version and the SHA-256 prefix of its prompt block. The pipeline supplies the per-Profile inputs when it runs.

| Command | Behavior |
|---|---|
| `finalize --qids=Q1,Q2` | Resolves subject and Connection QIDs, removes Connections outside the dataset, adds metadata, saves the extracted drafts with their pending assessments, and removes successfully finalized staging files. |
| `verify --qids=Q1,Q2 --repair` | Checks every visible field against fetched evidence, audits the result and can repair up to twice. It withholds unresolved content and translates approved English. See [verification and human review](profile-verification.md). |
| `audit --qids=Q1,Q2` | Runs an independent audit against saved verification evidence and prints results and token usage for comparison. See [comparing auditors](profile-verification.md#compare-auditors-on-saved-evidence). |
| `translate --qids=Q1,Q2` | Translates currently approved English Profiles into Russian and separately audits fidelity. Skips current translations. |

## Writer provenance

`finalize --run-id=<id>` groups records and preserves staged prompt provenance. Agents can supply `generation` with `prompt_version`, `prompt_hash` and `generated_at` when known. Missing values stay null.

Writer metadata stores `reasoning_effort` and `tokens: {input, output}` when available from the agent's runtime. [Coordinator workflow](profile-coordinator.md)

## Publication

Verification, translation and Output use the same approval check for the saved receipt and current dataset dates. Output accepts English Profiles with that approval and a review status of `reviewed` or `edited`. Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports and `*.ru.translation.json` artifacts. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian Profiles require a current approved translation. Only locales with a shipped Profile get `hasProfile`. Output and the web app read saved files. [Translation workflow](profile-translation.md)
