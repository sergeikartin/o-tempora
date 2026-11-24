# Profile pipeline

A Profile replaces the Wikipedia Description with an overview, Key Moments, up to three Deep Facts and Connections to other entities. The web app loads it on demand and uses the Description if loading fails.

## Workflow

Writing and verification run separately from `build-data`. Run these commands from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

Give the [Profile coordinator](profile-coordinator.md) the QIDs selected in chat and the requested outcome. The coordinator prefetches a Source Map before dispatching a writer. The writer reads the evidence, stages one assessed Profile in `incoming/<QID>.json` and runs local preflight. Finalization extracts the draft and saves its matching assessment. High-risk claims receive an adversarial evidence check before the independent audit. Fresh conversation subagents write and review the content. The CLI applies their replies and issues the receipts. Prompts in `prompts/` record their version and the SHA-256 prefix of the instructions.

| Command | Behavior |
|---|---|
| `status [--qids=Q1,Q2 \| --scope=legendary\|mainstream\|all]` | Reports each QID’s stage and next command from local artifacts. The default scope is Legendary and Mainstream People and Milestones. |
| `prefetch --qids=Q1,Q2` | Saves the subject’s Wikipedia article and up to five ranked, distinct-host references to the evidence cache. Use `--max-sources=<n>` to set a limit from 1 to 8. `--concurrency=<n>` defaults to 1 and accepts up to 3 QIDs at a time. |
| `evidence --url=<https URL>` | Reads a cached or fetched excerpt. Use `--query=<phrase>` and `--offset=<n>` to jump and `--length=<n>` for 500–8,000 characters. Use `--outline` on its own for the title, character count and heading offsets. |
| `preflight --qid=Q1` | Checks the staged Profile and its cached evidence offline. Use `--file=<path>` for a staged file, repair reply or finalized English draft with a saved assessment. Emits counts and field issues as JSON and exits nonzero on failure. |
| `finalize --qids=Q1,Q2` | Resolves subject and Connection QIDs, keeps the first Connection for each distinct dataset target other than the subject, adds metadata, saves the extracted drafts with their pending assessments, and removes successfully finalized staging files. |

The coordinator keeps tasks and replies in `<workdir>/<QID>/` and uses `status` to resume after interruptions. See the [coordinator workflow](profile-coordinator.md) for English and Russian audit commands.

## Local caches

Prefetch writes a Source Map per QID under `evidence/prefetch/`. Each map lists snapshot IDs, final URLs, titles, character counts, offsets for up to 60 level 1–3 headings, and skipped URLs. Prefetch records access blocks and unsupported content types in individual files under `evidence/blocked-hosts/` and skips those hosts for seven days. Wikipedia article requests share a pacing queue. Use `--refresh` to refetch snapshots and retry blocked hosts.

Profile subject lookups reuse `data/output/profile-subjects.cache.json` while the raw input sizes and modification times match. The CLI rebuilds a missing or stale cache. The read-only `status` command computes subjects in memory when the cache is stale or missing. `build-data` refreshes the cache from the rows it already transformed.

## Writer provenance

`finalize --run-id=<id>` groups records and preserves staged prompt provenance. Agents can supply `generation` with `prompt_version`, `prompt_hash` and `generated_at` when known. Missing values stay null.

Writer metadata stores `reasoning_effort` and `tokens: {input, output}` when available from the agent's runtime. [Coordinator workflow](profile-coordinator.md)

## Publication

New English reports use policy 7. Verification, translation and Output use the same approval check for the saved receipt and current dataset dates. Output accepts English Profiles with that approval and a review status of `reviewed` or `edited`. Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports and `*.ru.translation.json` artifacts. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian Profiles require a current approved translation. Only locales with a shipped Profile get `hasProfile`. Build and publish verify those flags against Profile files and check each Connection’s Slug, Lane and Detail Level against the locale’s dataset. Output and the web app read saved files. [Translation workflow](profile-translation.md)
