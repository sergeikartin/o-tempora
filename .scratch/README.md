# Tracker

Six active tickets and one rollout plan remain. Closed tickets stay in their feature directories with implementation evidence or a superseding reference. `Blocked by:` is satisfied when each dependency is resolved, done or superseded; `ready-for-agent` describes specified work, not whether its dependencies are satisfied.

| Work | Status | Next step |
|---|---|---|
| [Landing Curiosities & Profiles rollout](landing-curiosities-plan.md) | Active | Produce 12 missing bilingual Profiles across 4 batches, then integrate Milestone dots, Curiosities, and i18n copy |
| [Branded 404](product-polish/issues/02-branded-404.md) | Partial | Add Landing Page links, then check accessibility and Russian text fit |
| [Canvas craft](product-polish/issues/07-canvas-craft.md) | Partial | Finish visual/performance audit and owner review |
| [Empty Lane states](product-polish/issues/08-empty-lane-states.md) | Ready | Implement messages and actions |
| [Accessibility and touch](product-polish/issues/12-accessibility-and-touch-sweep.md) | Unblocked | Fix remaining landmark issue and complete the sweep |
| [Launch check](product-polish/issues/13-launch-check.md) | Blocked by accessibility | Audit both page kinds, widths and locales after ticket 12 |
| [Landing gaps](product-polish/issues/14-landing-gaps.md) | Unblocked | Enforce Mainstream availability; RU lengths and owner copy review |

Delivered efforts include the D3 migration, data-source changes, lane-scoped fetches, localization, Detail Level, prerendering, filters, navigation, and the Profiles Pipeline v2 (`profiles-pipeline-v2`). The obsolete zoom-driven density, sidebar-layout, first-30-profiles (`person-profiles/issues/12`), and batch-resumption (`full-profile-coverage/issues/03`) plans are superseded; their original acceptance lists are historical scope.

Ticket conventions: [issue tracker](../docs/agents/issue-tracker.md). Product polish details: [spec](product-polish/spec.md). Profile progress and decisions: [map](person-profiles/map.md).
