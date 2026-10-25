# Profile pipeline step

Type: grilling
Status: resolved
Blocked by: 04

## Question

How does the new data-pipeline step work? Cover: where it sits in the stage order; LLM client, model, API key and config (`docs/config-variables.md`); batching, caching and the `prompt_hash` skip / explicit-regenerate / never-overwrite-`edited` policy; matching each Wikipedia URL to a dataset entity via Wikidata QID, and the `related_matched` signal; where the raw JSON files live and whether they are committed; how Output publishes only what the web needs. Needs an ADR (`packages/data-pipeline/docs/adr/`).

## Answer

Decided in `packages/data-pipeline/docs/adr/0021-profiles-generated-from-model-knowledge-and-human-gated.md`. There is no pipeline stage and no LLM client: agents write the Profiles by hand-launched runs, and a deterministic script does the rest. In build terms:

- **Writer:** `.claude/agents/profile-writer.md` (Opus, `Read` and `Write` only, so it cannot browse). One per entity, run in parallel. It reads `packages/data-pipeline/prompts/profile.md`, fills in `{type}`, `{name}`, `{dates}`, `{wikipedia_url}` and writes the model's JSON, with no `meta`, to a gitignored staging path `data/raw/profiles/incoming/<QID>.json`.
- **`profiles` script** (`npm run`, no LLM, never part of `build-data`), two modes:
  - `plan`: for the chosen entities (`--qids=`, like fetch), prints the writer inputs (type, name, `{dates}` as BC/AD labels, English Wikipedia URL, staging path) and skips entities already at the current `prompt_hash` or marked `edited`. Regenerating a stale one needs an explicit flag and resets `reviewed` to `draft`. A model change never marks a record stale.
  - `finalize`: reads the staging files, schema-validates them, adds `meta`, writes `data/raw/profiles/<lane>/<QID>-<english-name>.en.json` (name frozen at creation), and deletes the staging file. It never overwrites `edited`. `prompt_hash` is the sha256 of the prompt block including its trailing newline. The People QID comes from Pantheon's `wd_id`.
- **`meta`:** `temperature` and `tokens` are null (a subagent does not expose them); `model` comes from the agent config; `source.wikidata_qid` is resolved from the Wikipedia URL and asserted equal to the entity's own QID.
- **Mechanical checks** in `meta.validation`, never blocking: `schema_valid`; each Connection URL resolved to a QID and looked up in people, conflicts and milestones (`connections_returned`, `connections_matched_people`, `connections_matched_events`), dropping any that match none; `connections_unresolved` and `connections_qid_mismatch` (a redirect landing on a different QID than the title implies) count the failures; `date_flags` lists years in the overview or key-moment dates that disagree with the entity's own dates (year-level, preferred-rank, tolerance).
- **Verifier:** `.claude/agents/profile-verifier.md` (Haiku) checks each `claims` entry against its `source` and writes a per-claim report beside the profile; it never edits the profile.
- Connections are one-directional: Output keeps only what the profile itself lists, with no merging across profiles.
- Output publishes only `reviewed` and `edited` Profiles. Russian files carry the English Profile whole (Field Fallback at Profile level). Which fields ship to `web` is ticket 05.
- Env vars and docs: none new; `docs/config-variables.md` is untouched.
