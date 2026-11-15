---
status: superseded
superseded-by: 0023-profiles-publish-after-evidence-backed-automatic-verification.md
supersedes: 0021-profiles-generated-from-model-knowledge-and-human-gated.md
---

# The Profile writer is a Claude Code agent or a provider API call

## Context

ADR 0021 had every Profile written by a hand-launched Claude Code subagent and rejected an LLM client "for now". Launching one agent per entity does not scale past the first batch, and the owner has an OpenAI API key and wants the choice of provider to be theirs.

## Decision

- A Profile is still written from the model's own knowledge, verified by a separate subagent (`.claude/agents/profile-verifier.md`), and gated by `review.status` (`draft | reviewed | edited`); Output ships only `reviewed` and `edited`. A deterministic script still plans, finalizes, never overwrites an `edited` record and records the mechanical checks. One committed JSON file per entity and language under `data/raw/profiles/<lane>/`, one prompt for all three lanes. None of this changes.
- The writer is now one of two interchangeable paths, both leaving `incoming/<QID>.json` for `finalize`:
  - the `profile-writer` Claude Code subagent, as before;
  - `profiles write`, which renders `prompts/profile.md`, sends it to a provider API, validates the reply with the same `parseModelProfile` the finalizer uses, and stages it.
- `profiles write` takes `--provider=openai|anthropic|gemini` (default `openai`) and `--model`. Defaults are `gpt-6-astra` (OpenAI's flagship, the nearest counterpart to the agent's Opus) and `claude-opus-5-5` and `gemini-4-argon` (Google's flagship). All go through the providers' official SDKs, with keys from `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`. Sampling parameters are not sent, so `meta.temperature` stays null.
- A staged file written by `profiles write` carries a `writer` block (`provider`, `model`, `tokens`). `finalize` copies the model and token counts into `meta`; a file without the block (an agent's) falls back to the agent's `model:` and null tokens. The block is not part of the shipped record.

## Why

The staged JSON file is the seam, so adding an API writer touches no downstream stage: the same validation, QID resolution and review gate apply whoever wrote the file. Recording the served model and real token counts for API-written Profiles makes quality and cost comparable between providers, which the agent path could not.

## Considered Options

**A provider-neutral `LlmClient` interface with a pipeline stage inside `build-data`.** Rejected — Profiles stay a separate, human-gated step; `write` is an explicit command run per chosen batch.

**Raw `fetch` against each provider.** Rejected — the official SDKs handle retries, streaming and typed errors.

**Replace the agent with the API writer.** Rejected — the agent needs no key and stays useful for small batches.

## Consequences

`@anthropic-ai/sdk`, `openai` and `@google/genai` become dependencies of `data-pipeline`, and `write` makes paid network calls, which is the pipeline's first use of provider credentials. A run is still not reproducible bit for bit. Output from different providers lands in the same folder at different quality, so `meta.model` is what tells them apart during review.
