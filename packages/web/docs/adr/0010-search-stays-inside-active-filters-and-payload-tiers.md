# Search stays inside active filters and Payload Tiers, rather than searching everything

## Context

The new search bar (`.scratch/pre-launch-readiness/issues/15-search-bar.md`) matches Name/Tagline across all three lanes. Two tempting "make it comprehensive" moves were considered and rejected: force-loading Tier 1 (ADR 0004's deferred long-tail data) the moment the user types, and matching independently of the Region/Occupation Domain/Conflicts & Milestones filters so a query could surface entries the current view has otherwise excluded.

## Decision

Search only ever matches what the current Data Depth floor, Region, Occupation Domain, and Conflicts & Milestones filters, and whatever Payload Tier data has already loaded, already permit. It never force-triggers the deferred Tier 1 fetch and never bypasses the pill filters to widen its own result set.

## Why

`docs/product-scope.md` already excludes "search outside the current Data Depth/fame-score floor" from v1. Force-loading Tier 1 on first keystroke would undermine ADR 0004's whole rationale (deferring/skipping the long tail on slow or save-data connections) for the sake of search completeness. Bypassing the other filters would let a result surface that the user can't actually see without the app silently lifting filters on their behalf — confusing, and inconsistent with the "what you see is what's searchable" rule already applied to Data Depth.

## Considered Options

**Force-load Tier 1 on first keystroke.** Rejected — defeats the point of deferring it.

**Search independently of Region/Occupation Domain/Conflicts & Milestones filters.** Rejected — a result appearing with no visible entry to jump to would read as broken, and picking it would require deciding whether to silently clear filters, which raises its own confusing-UX problem.
