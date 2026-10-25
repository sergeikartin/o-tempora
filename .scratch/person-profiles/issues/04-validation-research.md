# Validating Profile correctness

Type: research
Status: resolved
Blocked by:

## Question

How can the pipeline keep LLM-written Profiles factually sound? Gather evidence on: grounding the prompt with the entity's Wikipedia article or the existing `*-wikipedia-extracts.raw.json` text versus relying on the model's memory; cheap automatic checks (dates against Wikidata, Connection URLs resolving, quote/number claims, a second-model verifier); how the `confidence` and `is_legend` fields and the `review.status` workflow (`draft | reviewed | edited`) fit; realistic reviewer effort for 30 entities. Output: findings with sources and a recommended validation approach, not a decision.

## Answer

Findings: `.scratch/person-profiles/research/profile-validation.md` on branch `research/profile-validation` (origin, no PR; commit `309654d`). Recommended approach, not a decision:

- Ground Key Moments and Deep Facts on the full Wikipedia article text (one API call per entity, about 48k–90k characters). The existing lead extracts (median about 366 characters for people, about 480 for conflicts and milestones) are too short.
- The Citations API can't be combined with JSON structured output, so add an `evidence` verbatim-quote field per claim and check it by substring match in the pipeline. This changes the prompt's output shape.
- Compare Connection URLs by Wikidata QID, not HTTP status: `Armada Española` redirects to `Spanish Navy`.
- Check dates by year, against the preferred-rank Wikidata statement, with a tolerance.
- Skip a second-model verifier at 30 entities. Treat `confidence` and `is_legend` as review-queue ordering signals, not gates. Store the article-text hash in `meta` beside `prompt_hash`.
- Reviewer effort (estimate): about 2.5–5 hours with grounding and automatic checks, versus about 7.5–12.5 hours without.
- The file lists open questions for tickets 02, 03 and 07.
