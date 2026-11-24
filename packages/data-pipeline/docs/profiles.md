# Profile pipeline

A Profile replaces the Wikipedia Description with an overview, Key Moments, up to three Deep Facts and Connections to other entities. The web app loads it on demand and uses the Description if loading fails.

## Workflow

Writing and verification run separately from `build-data`. Run these commands from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

Give the [Profile coordinator](profile-coordinator.md) the QIDs selected in chat and the requested outcome. The coordinator prefetches a Source Map before dispatching a writer. The writer reads the evidence, stages one assessed Profile in `incoming/<QID>.json` and runs local preflight. Finalization extracts the draft and saves its matching assessment. High-risk claims receive an adversarial evidence check before the independent audit. The coordinator runs `verify`, `audit` and `translate` when provider API execution is requested for those steps.

The [Profile model routing module](../src/profiles/model-routing.ts) owns provider defaults and model overrides for verification, adversarial checking, audit and translation.

The prompts for [writing](../prompts/profile.md), [verification research](../prompts/profile-research.md), [adversarial verification](../prompts/profile-adversarial.md), [English audit](../prompts/profile-audit.md), [English repair](../prompts/profile-repair.md), [Russian translation](../prompts/profile-translation.md), [translation repair](../prompts/profile-translation-repair.md) and [translation audit](../prompts/profile-translation-audit.md) live in `prompts/`. The [assessed Profile format](../prompts/profile-assessment.md) is shared by the writer and the [coordinator repair agent](../prompts/profile-assessment-repair.md). Each file records its version and the SHA-256 prefix of its prompt block. The pipeline supplies the per-Profile inputs when it runs.

| Command | Behavior |
|---|---|
| `prefetch --qids=Q1,Q2` | Saves the subject’s Wikipedia article and up to five ranked, distinct-host references to the evidence cache. Use `--max-sources=<n>` to set a limit from 1 to 8. |
| `evidence --url=<https URL>` | Reads a cached or fetched excerpt. Use `--query=<phrase>` and `--offset=<n>` to jump and `--length=<n>` for 500–8,000 characters. Use `--outline` on its own for the title, character count and heading offsets. |
| `preflight --qid=Q1` | Checks the staged Profile and its cached evidence offline. Use `--file=<path>` for a staged file, repair reply or finalized English draft with a saved assessment. Emits counts and field issues as JSON and exits nonzero on failure. |
| `finalize --qids=Q1,Q2` | Resolves subject and Connection QIDs, removes Connections outside the dataset, adds metadata, saves the extracted drafts with their pending assessments, and removes successfully finalized staging files. |
| `verify --qids=Q1,Q2 --repair` | Checks every visible field against fetched evidence, runs adversarial research on up to five high-risk findings, audits the result and can repair up to twice. `--adversarial-model=<id>` selects a separate OpenAI model, and `--no-adversarial` disables the adversarial phase. It withholds unresolved content and translates approved English. See [verification and human review](profile-verification.md). |
| `audit --qids=Q1,Q2` | Runs an independent audit against saved verification evidence with available source titles and headings and prints results and token usage for comparison. See [comparing auditors](profile-verification.md#compare-auditors-on-saved-evidence). |
| `translate --qids=Q1,Q2` | Translates currently approved English Profiles into Russian and separately audits fidelity. Skips current translations. |

## Local caches

Prefetch writes a Source Map per QID under `evidence/prefetch/`. Each map lists snapshot IDs, final URLs, titles, character counts, offsets for up to 60 level 1–3 headings, and skipped URLs. Prefetch skips hosts with a recorded access block or unsupported content type for seven days. Use `--refresh` to refetch snapshots and retry blocked hosts.

Profile subject lookups reuse `data/output/profile-subjects.cache.json` while the raw input sizes and modification times match. The CLI rebuilds a missing or stale cache, and `build-data` refreshes it from the rows it already transformed.

## Writer provenance

`finalize --run-id=<id>` groups records and preserves staged prompt provenance. Agents can supply `generation` with `prompt_version`, `prompt_hash` and `generated_at` when known. Missing values stay null.

Writer metadata stores `reasoning_effort` and `tokens: {input, output}` when available from the agent's runtime. [Coordinator workflow](profile-coordinator.md)

## Publication

New English reports use policy 7. Verification, translation and Output use the same approval check for the saved receipt and current dataset dates. Output accepts English Profiles with that approval and a review status of `reviewed` or `edited`. Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports and `*.ru.translation.json` artifacts. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian Profiles require a current approved translation. Only locales with a shipped Profile get `hasProfile`. Output and the web app read saved files. [Translation workflow](profile-translation.md)
