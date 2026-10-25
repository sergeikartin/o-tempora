---
status: accepted
---

# Profiles are written by agents from model knowledge, verified by a subagent, and gated by review

## Context

A Profile (`CONTEXT.md`) is LLM-written prose with claims about dates, people and events. Models are least reliable on obscure facts, which is exactly what Deep Facts are. The pipeline's only live sources so far (Wikidata, Wikipedia) are fetched, never generated.

## Decision

- Each Profile is written by a Claude Code subagent (`.claude/agents/profile-writer.md`, Opus, `Read` and `Write` only), one per entity, launched by hand. There is no pipeline stage, no LLM client and no API key. The model writes from its own knowledge: no Wikipedia article text is supplied and no quoted `evidence` is required.
- A deterministic script, with no LLM, plans what to generate and finalizes what the agents wrote. It skips entities already at the current `prompt_hash`, never overwrites an `edited` record, adds `meta`, resolves Connection URLs to QIDs and records the mechanical checks in `meta.validation`. It is the only part that is code.
- Each Profile is one committed JSON file per entity and language under `data/raw/profiles/<lane>/`, named `<QID>-<english-name>` and joined to its entity by `meta.source.wikidata_qid`. Output only reads these files, so a later automated stage can write the same files.
- One prompt serves all three lanes, branching on the entity type. Every Key Moment and Deep Fact carries standalone `claims` and a Wikipedia `source`, so a verifier has concrete statements to check.
- Factual verification is a separate Claude Code subagent (`.claude/agents/profile-verifier.md`), on a cheaper model than the writer, that checks each claim against its source and writes a per-claim report beside the Profile. It never edits the Profile.
- `review.status` (`draft | reviewed | edited`) gates publishing: Output ships only `reviewed` and `edited` Profiles.

## Why

Agents keep the first batch of about 30 free of an LLM client, provider seam, API key and pipeline stage, and the file format stays the seam for any later automation. Verification as a separate agent keeps the writer's prompt simple and lets the checker use web sources the writer never saw; the human gate keeps unreviewed claims off the site. Mechanical checks catch the failures that are cheap to detect (a Connection URL that resolves to the wrong entity, a wrong birth year) without a second model.

## Considered Options

**A `profile` pipeline stage with an `LlmClient` interface and provider swap.** Rejected for now — more code, config and API cost than 30 entities justify. It returns if rollout beyond the first batch needs unattended runs; it would write the same files.

**Ground the prompt on the full Wikipedia article with verbatim `evidence` quotes.** Rejected — it would verify faithfulness to Wikipedia rather than to the facts, and add an article fetch and cache. Memory-only generation puts the burden on the verifier and the reviewer, a cost accepted for a small first batch.

**A second-model verifier inside the pipeline.** Rejected — an extra stage and prompt to tune for a batch of about 30; an ad hoc agent can browse sources and is easy to replace.

## Consequences

A subagent does not expose temperature or token counts, so `meta.temperature` and `meta.tokens` are null for agent-written Profiles, and a run is not reproducible bit for bit.
