# Profile generation

Profiles are written and verified offline, outside `build-data`. All commands below run from the repo root through `npm run profiles --workspace packages/data-pipeline -- <command>`.

| Command | Behavior |
|---|---|
| `plan --qids=Q1,Q2` | Prints writer inputs and staging paths for the chosen batch. |
| `write --qids=Q1,Q2` | Calls a provider, validates replies and stages `incoming/<QID>.json`. |
| `finalize` | Resolves subject and Connection QIDs, removes Connections outside the dataset, adds metadata, writes drafts and removes successfully finalized staging files. |
| `verify --qids=Q1,Q2 --repair` | Checks sources, audits claims, repairs up to twice and approves only passing content. See [verification](profile-verification.md). |

`plan` and `write` skip current-prompt records, stale records unless `--regenerate-stale` is set, and all `edited` records. Regeneration resets approval to `draft`; edited prose is protected. A `profile-writer` agent can stage the same JSON without an API key.

API writing accepts `--provider=openai|anthropic|gemini`, `--model=<id>` and `--concurrency=<n>` (default 3). Defaults live in `src/profiles/providers.ts`; credentials are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`. A failed item is reported without stopping the batch. `finalize --run-id=<id>` groups generated records; it preserves the served writer model and token counts.

Raw files live at `data/raw/profiles/<lane>/<QID>-<english-name>.en.json`. Output reads the raw file and its verification report, then ships approved Profiles as `data/output/profiles/<locale>/<slug>.json`. Russian files carry the English Profile whole. `publish-data` copies these files into `shared-types`; no provider or source calls happen during Output or in the web app.
