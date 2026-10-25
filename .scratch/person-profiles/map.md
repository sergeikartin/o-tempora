# Map: Profiles

## Destination

A spec at `.scratch/person-profiles/spec.md` for **Profiles**: LLM-generated, memory-oriented pieces (overview, **Key Moments**, **Deep Facts**, **Connections**) that replace the date-overlap comparison. Visitors remember who an entity was and wander to related entities. The spec lists the build tickets; nothing is built in this map.

## Notes

Terms: **Profile**, **Key Moment**, **Deep Facts**, **Connection**, **Detail Level**, **Selection**, **Entity Link**, **Description** in `CONTEXT.md`. The prompt (`packages/data-pipeline/prompts/profile.md`) is the user's. Consult `grilling` and `domain-modeling` for HITL tickets; record new terms in `CONTEXT.md`.

Settled in charting:
- Profiles replace the date-overlap comparison (Selection becomes one entity; Span/Overlap Bands retire; superseding ADRs).
- A Profile = overview + Key Moments + up to 3 Deep Facts + Connections; it replaces the Description in the panel. Entities without a Profile keep the Description. The model outputs no categories.
- Connections are their own section and may target any lane. Hidden only when the target is not in the dataset (still in the JSON). A target below the current Detail Level is listed, marked with the level it appears at, and opening it raises the Detail Level the way an Entity Link does. Filters do not gate them.
- A new pipeline step writes JSON; one prompt serves all three lanes. Skip results already at the current `prompt_hash`; regenerate stale only on an explicit flag; never overwrite `edited` records.
- Every Connection hop adds a history entry; mark clicks and Search keep today's rule.
- First batch: 30 entities from Legendary in five hand-picked connected clusters. English-only; Russian files carry the English Profile whole (Field Fallback at Profile level).
- Deep Facts exist to be remembered, not to quiz.

## Decisions so far

<!-- one line per resolved ticket -->

- [Validating Profile correctness](issues/04-validation-research.md): research recommended grounding on the full article with `evidence` quotes; the owner chose model knowledge instead (see 03). Still used: Connection URLs compared by QID, year-level date checks; findings on branch `research/profile-validation`.
- [Profile prompt](issues/02-prompt-revision.md): one prompt for all lanes, `packages/data-pipeline/prompts/profile.md` v2.1.0 — `{type}` branches inside the text, `claims` and a Wikipedia `source` per Key Moment and Deep Fact for the verifier, any-lane Connections, no categories, English only.
- [Conflict and Milestone prompts](issues/07-conflict-milestone-prompts.md): none needed; the unified prompt covers them.
- [Profile pipeline step](issues/03-pipeline-step.md): no stage or LLM client; an Opus `profile-writer` subagent per entity plus a deterministic `profiles` plan/finalize script, one JSON per profile, a Haiku `profile-verifier` subagent, only `reviewed`/`edited` publish; ADR `packages/data-pipeline/docs/adr/0021-profiles-generated-from-model-knowledge-and-human-gated.md`.
- [The 30-entity sample](issues/06-sample-selection.md): 20 People, 4 Conflicts, 6 Milestones in five Legendary clusters, one batch.
- [Profile panel prototype](issues/01-profile-panel-prototype.md): approved and committed (`72ddbd0`). The drawer widens to 440px with the name and tagline pinned; overview, Key Moments, Deep Facts and Connections sections; a below-level Connection carries the Detail Level pips and "Appears at <level>" and opening it raises the Detail Level. Docked-panel idea still open.
- Backlinks: none — a Connection is one-directional and appears only on the Profile that lists it, so Connections can be asymmetric.

## Not yet specified

- Rollout beyond Legendary and beyond the 30-entity sample.
- Russian Profiles: wanted at rollout, deferred for now. Development, prototype and the first batch are English-only; Russian files keep carrying the English Profile whole.
- The ADR set and living-doc updates that retiring the Selection comparison forces (root ADR for Selection-as-set, web ADRs for URL/Entity Link and chrome).
- How the review gate is automated (ticket 08); until then only the user promotes `draft` to `reviewed`.

## Out of scope

- A quiz feature (Deep Facts are written quiz-grade, but the product never quizzes); filtering or navigating by categories.
- Live LLM calls from the web app.
