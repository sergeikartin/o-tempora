# Map: Profiles

## Destination

A spec at `.scratch/person-profiles/spec.md` for **Profiles**: LLM-generated, memory-oriented pieces (overview, **Key Moments**, **Deep Facts**, **Connections**) that replace the date-overlap comparison. Visitors remember who an entity was and wander to related entities.

## Implementation status

Types/output, plan/finalize, runtime panel loading, single-entity Selection, Connection history and the landing handoff are implemented (tickets 10, 11, 13–15 and 17 resolved). Thirty raw Profiles exist: 20 People, 4 Conflicts and 6 Milestones. Cleopatra, Gregorian calendar and Isaac Newton are automatically approved and published in both locales (Russian uses approved automatic translations); the other 27 remain `draft`. [Manual audits of five](reviews/README.md) found corrections and evidence gaps; sample membership and Connection-target presence are checked. Review automation (08) is implemented. The remaining work is live batch verification/audit (12) and the docs/ADR sweep (16).

## Notes

Terms: **Profile**, **Key Moment**, **Deep Facts**, **Connection**, **Detail Level**, **Selection**, **Entity Link**, **Description** in `CONTEXT.md`. The prompt (`packages/data-pipeline/prompts/profile.md`) is the user's. Consult `grilling` and `domain-modeling` for HITL tickets; record new terms in `CONTEXT.md`.

Settled in charting:
- Profiles replace the date-overlap comparison (Selection becomes one entity; Span/Overlap Bands retire; superseding ADRs).
- A Profile = overview + Key Moments + up to 3 Deep Facts + Connections; it replaces the Description in the panel. Entities without a Profile keep the Description. The model outputs no categories.
- Connections are their own section and may target any lane. Hidden only when the target is not in the dataset (still in the JSON). A target below the current Detail Level is listed, marked with the level it appears at, and opening it raises the Detail Level the way an Entity Link does. Filters do not gate them.
- A new pipeline step writes JSON; one prompt serves all three lanes. Skip results already at the current `prompt_hash`; regenerate stale only on an explicit flag; never overwrite `edited` records.
- Every Connection hop adds a history entry; mark clicks and Search keep today's rule.
- First batch: 30 entities from Legendary in five hand-picked connected clusters. English originals; Russian Profiles are automatically translated after English approval and independently audited for fidelity.
- Deep Facts exist to be remembered, not to quiz.

## Decisions so far

- [Automatic Russian translation](issues/18-automatic-russian-translation.md): approved English is translated offline and independently audited; one correction attempt is followed by full re-audit. Translation approvals bind the exact source and policy. Missing/stale translations leave Russian Description; three existing approvals are translated and published. Pipeline ADR 0026.

- [Automate the review gate](issues/08-automate-review-gate.md): offline evidence-backed verification, separate coverage audit, bounded repair and hash-bound automatic approval; protected edits receive proposals. Human review is for essential unresolved claims and sampled approvals. ADR 0023 supersedes the human gate; the initial live batch remains pending.

<!-- one line per resolved ticket -->

- [Validating Profile correctness](issues/04-validation-research.md): research recommended grounding on the full article with `evidence` quotes; the owner chose model knowledge instead (see 03). Still used: Connection URLs compared by QID, year-level date checks; findings on branch `research/profile-validation`.
- [Profile prompt](issues/02-prompt-revision.md): one prompt for all lanes, `packages/data-pipeline/prompts/profile.md` v2.1.0 — `{type}` branches inside the text, `claims` and a Wikipedia `source` per Key Moment and Deep Fact for the verifier, any-lane Connections, no categories, English only.
- [Conflict and Milestone prompts](issues/07-conflict-milestone-prompts.md): none needed; the unified prompt covers them.
- [Profile pipeline step](issues/03-pipeline-step.md): no stage or LLM client; an Opus `profile-writer` subagent per entity plus a deterministic `profiles` plan/finalize script, one JSON per profile, a Haiku `profile-verifier` subagent, only `reviewed`/`edited` publish; ADR `packages/data-pipeline/docs/adr/0021-profiles-generated-from-model-knowledge-and-human-gated.md`.
- [The 30-entity sample](issues/06-sample-selection.md): 20 People, 4 Conflicts, 6 Milestones in five Legendary clusters, one batch.
- [Profile panel prototype](issues/01-profile-panel-prototype.md): approved and committed (`72ddbd0`). The drawer widens to 440px with the name and tagline pinned; overview, Key Moments, Deep Facts and Connections sections; a below-level Connection carries the Detail Level pips and "Appears at <level>" and opening it raises the Detail Level. Docked-panel idea still open.
- [Shipped Profile data shape](issues/05-shipped-data-shape.md): one static file per entity per Locale (`profiles/<locale>/<slug>.json`) fetched at runtime when the panel opens; Output marks rows `hasProfile`; `ru` uses current approved translations of English Profiles; Connections store `{slug, reason, name, lane, detailLevel}`; failed fetch falls back to the Description; `**bold**` rendered as elements.
- Selection: one entity (owner chose; spec "Selection becomes one entity"). Multi-select, bands and the Entity Link's repeated `?e=` go; the Landing Page call-to-action is reopened.
- [Landing Page without a multi-Selection](issues/09-landing-without-multi-selection.md): a Curiosity stays a hand-picked coincidence but is Profile-led; its button opens a `lead` entity with a landing-only `#moment-<n>` / `#fact-<n>` fragment that scrolls to and accents that item; per-mark links and `landing_mark_open` go; Connections never depend on Curiosities.
- Backlinks: none — a Connection is one-directional and appears only on the Profile that lists it, so Connections can be asymmetric.

## Remaining work

- Rollout beyond Legendary and beyond the 30-entity sample.
- Independently authored Russian Profiles remain deferred; the pipeline automatically translates approved English Profiles and audits fidelity before Russian publication.
- [Docs and ADRs](issues/16-docs-and-adrs.md): unblocked. Selection-as-one-entity and runtime-fetch ADRs exist; landing fragments, Connection history and the living-doc sweep still need reconciliation.
- [Generate and review the 30](issues/12-generate-and-review-the-30.md): drafts are written; live verification, sampled human audit and remaining acceptance evidence are pending.

## Out of scope

- A quiz feature (Deep Facts are written quiz-grade, but the product never quizzes); filtering or navigating by categories.
- Live LLM calls from the web app.
