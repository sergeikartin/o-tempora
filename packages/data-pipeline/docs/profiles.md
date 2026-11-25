# Profile pipeline

A Profile replaces the Wikipedia Description with an overview, Key Moments, up to three Deep Facts and Connections to other entities. The web app loads it on demand and uses the Description if loading fails.

## Workflow

Writing and verification run separately from `build-data`. Run these commands from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

Give the [Profile coordinator](profile-coordinator.md) the QIDs selected in chat and the requested outcome. The coordinator runs `profile-scout` (discovering supporting and competing/dispute sources upfront) and prefetches a Source Map before dispatching a writer. The writer reads both supporting and competing evidence, stages one assessed Profile in `incoming/<QID>.json` and runs local validation. Finalization writes the clean draft to `data/raw/profiles/<lane>/` and keeps transient pending assessment state in gitignored `tasks/<QID>/pending.json`. Fresh conversation subagents write and audit the content. The CLI applies their replies and issues the receipts. Prompts in `prompts/` record their version and the SHA-256 prefix of the instructions.

| Command | Behavior |
|---|---|
| `status [--qids=Q1,Q2 \| --scope=legendary\|mainstream\|all] [--stage=<stage1,stage2,...>] [--limit=<n>]` | Reports each QID’s stage and next command from local artifacts. Stage filtering precedes the limit. Summary counts describe the returned items. The default scope is Legendary and Mainstream People and Milestones. |
| `prefetch --qids=Q1,Q2` | Saves the subject’s Wikipedia article and external references to the evidence cache. Without explicit URLs, fetches up to five ranked, distinct-host Wikipedia references (`--max-sources=<1..8>`, `--concurrency=<1..3>`). For a single QID, pass `--manifest=<file>` (from `profile-scout`) or `--urls=<url1,url2,...>` to fetch those URLs directly instead of crawling Wikipedia links and group manifest results under `manifest_groups` with `dispute_source_ids` and `corroboration_ready` flags. |
| `evidence --url=<https URL>` | Reads a cached or fetched excerpt (omitting anchor/heading arrays from excerpt replies to keep tool output compact). Use `--query=<phrase>` and `--offset=<n>` to jump and `--length=<n>` for 500–8,000 characters. Use `--outline` on its own for the title, character count and heading offsets. Use `--batch=<json\|@file>` (up to 12 requests) to read multiple excerpts/outlines in one command. Shares the 7-day `blocked-hosts` cache and single-attempt bot-wall rejection for external URLs (`--refresh` bypasses and clears blocks). |
| `validate --qid=Q1` | Checks the staged Profile and its cached evidence offline, including source-kind consistency (Wikipedia URLs, canonical primary-text editions, and low-trust reference sites). Use `--file=<path>` for a staged file, compact repair patch reply, full repair reply, or finalized English draft with a saved assessment. Emits counts and field issues as JSON and exits nonzero on failure. |
| `finalize --qids=Q1,Q2 [--model=<id>]` | Resolves subject and Connection QIDs, keeps the first Connection for each distinct dataset target other than the subject, adds metadata, saves the clean draft alongside gitignored `tasks/<QID>/pending.json`, and removes successfully finalized staging files. The staged `writer.model` takes precedence over the fallback `--model` value. |
| `english-audit`, `english-repair`, `russian-translation`, `russian-audit` | Add `--out=<file>` when preparing a task. Prints a compact summary on success. `skipped` leaves the output file untouched. Commands that apply replies use `--result=<file>` in place of `--out`. |

The coordinator keeps tasks and replies in gitignored `data/raw/profiles/tasks/<QID>/` and uses `status` to resume after interruptions. [Coordinator workflow](profile-coordinator.md)

## Local caches

Prefetch writes a Source Map per QID under `evidence/prefetch/`. Each map lists snapshot IDs, final URLs, titles, character counts, offsets for up to 60 level 1–3 headings, skipped URLs, and (in `--manifest` mode) `manifest_groups` linking cached snapshot IDs back to `core`, `deep_fact_candidates` (with `corroboration_ready`), and `dispute`. Prefetch and `evidence` share fail-fast single-attempt fetches with bot-challenge rejection on external pages (prefetch also enforces a 1,000-character floor), record HTTP 403/410/451 and bot-challenge blocks per normalized hostname under `evidence/blocked-hosts/` (skipping them for seven days without blacklisting hosts on non-HTML/PDF links), and share a pacing queue for Wikipedia requests. Use `--refresh` to refetch snapshots and retry blocked hosts. Resolved Wikipedia article URL → Wikidata QID mappings are cached for 30 days under `evidence/wikipedia-qids.json` so audits and repairs avoid redundant live Wikipedia lookups.

Profile subject lookups reuse `data/output/profile-subjects.cache.json` while the raw input sizes and modification times match. The CLI rebuilds a missing or stale cache. The read-only `status` command computes subjects in memory when the cache is stale or missing. `build-data` refreshes the cache from the rows it already transformed.

## Writer provenance

`finalize --run-id=<id>` groups records and preserves staged prompt provenance. Agents can supply `generation` with `prompt_version`, `prompt_hash` and `generated_at` when known. Missing values stay null.

Writers record their actual serving model ID in `writer.model`. If it is absent, `finalize` uses `--model` or the Claude writer configuration when the flag is omitted. Writer metadata stores `reasoning_effort` and `tokens: {input, output}` when available from the agent's runtime. [Coordinator workflow](profile-coordinator.md)

## Publication

New English reports use policy 8. Verification, translation and Output use the same approval check for the saved receipt and current dataset dates. Output accepts English Profiles with that approval and a review status of `reviewed` or `edited`. Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`, alongside their `*.verification.json` reports and `*.ru.translation.json` artifacts. Run `npm run build-data --workspace packages/data-pipeline` to produce approved Profiles at `data/output/profiles/<locale>/<slug>.json`, then `npm run publish-data --workspace packages/data-pipeline` to copy them into `shared-types`. Russian Profiles require a current approved translation. Only locales with a shipped Profile get `hasProfile`. Build and publish verify those flags against Profile files and check each Connection’s Slug, Lane and Detail Level against the locale’s dataset. Output and the web app read saved files. [Translation workflow](profile-translation.md)
