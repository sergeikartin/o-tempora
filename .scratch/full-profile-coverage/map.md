# Full Profile coverage on the current plan

Label: wayfinder:map

## Destination

Decide how to publish current-depth Profiles for every Legendary and Mainstream Person and Milestone across successive five-hour usage windows on the current plan.

## Notes

Plan for English and Russian and retain existing approval checks. The published dataset at charting contains 189 People and 108 Milestones in scope, with four subjects published in both Locales. Unpublished subjects may already have drafts. Use the [existing Profile decisions](../person-profiles/map.md) and [coordinator workflow](../../packages/data-pipeline/docs/profile-coordinator.md). Consult grilling and domain-modeling for decision discussions.

## Decisions so far

- [Coverage baseline](issues/01-baseline.md): 4 of 297 subjects are published in both Locales, 22 have older English drafts, and 271 need a first draft. Mixed historical windows leave fresh-Profile throughput unmeasured. A serial pilot would measure stage usage and test whether the older drafts meet the current Deep Fact criteria.
- [Fresh Profile pilot](issues/01-baseline.md#fresh-profile-pilot-2026-11-22): Beethoven earned English and Russian approval after two automatic repairs, a restart, editorial changes and one Russian correction. The weekly meter rose from 10% to 21% over two five-hour windows. [Resumption and measurements](issues/01-baseline.md#pilot-resumption-2026-11-23).
- [Leonardo da Vinci trial](issues/01-baseline.md#leonardo-da-vinci-trial-2026-11-23): The one-shot workflow earned English approval in 22m 31s. Russian remained held after its correction. English review and repair took longer than research and drafting. The weekly meter rose from 23% to 30%.
- [Workflow trial](issues/02-workflow.md): On the next unwritten Profile, cite trustworthy fetched evidence for Key Moments and Deep Facts. Keep the change if the first English audit finds zero citation mismatches and no new citation-quality issues. Track weekly usage per bilingual approval across successive attempts.
- Count Profiles with both Locales approved per week as the throughput measure. Track elapsed time to English approval separately.
- [Curie Russian retry](issues/01-baseline.md#marie-curie-russian-retry): A translation self-check, field-only correction and fresh full audit produced a Russian approval. Use the [Russian coordinator workflow](../../packages/data-pipeline/docs/profile-coordinator.md#russian) for this process.
- The agreed CLI follow-up is to accept replacements for fields with blocking findings, merge them into the held candidate, validate the complete Profile and prepare it for a fresh full audit. The coordinator currently merges replacements in a temporary full candidate.

## Not yet specified

The evidence may reveal avoidable repeated work or a need for better measurements. The number of windows required depends on observed throughput.

A trial on three fresh Legendary Profiles was proposed.

## Out of scope

Paid provider API calls, shorter Profiles, and running the production backlog as part of charting.
