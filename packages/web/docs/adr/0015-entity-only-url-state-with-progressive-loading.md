---
status: superseded
superseded-by: 0016-url-carries-a-selection-and-arrival-fits-it.md
---

# URL state is the selected entity only, resolved by loading deeper levels progressively

## Context

Starting Points and shared links need a URL that reopens a specific entity, but the app's view state (viewport, Detail Level, four filters) is large, changes continuously while panning, and would make every link depend on the sender's exact view. Entities also live in Detail Level delta files (CONTEXT.md), so an entity may not be in the data loaded at first paint.

## Decision

The only URL state is `?e=<slug>`. Panning, zooming, Detail Level and filters never touch it.

- Selecting an entity `pushState`s, so Back closes the panel; closing replaces the entry so Back doesn't reopen it. `popstate` re-resolves whatever slug the URL then holds.
- A slug absent from the loaded data requests level 3, then level 4, one at a time, stopping at the first level that contains it. The Detail Level is raised only as far as the entity's Fame Score needs (never lowered). If no level contains it the link is dropped from the URL and the timeline opens with no panel.
- Once found, the entity opens exactly as a Search pick: panel plus pan.
- The language switch appends the open entity's slug to the sibling locale's home URL.
- The slug is read after mount, not during the first render, because the prerendered HTML has no link and hydration does not patch attribute mismatches.

## Why

A slug is readable and unique across lanes (`packages/data-pipeline/docs/adr/0020-…`), so no entity type is needed in the URL, and it is the same in both locales, so the language switch carries it unchanged. Progressive loading keeps level 4 strictly on-demand (ADR 0006) for every link that doesn't need it. Dropping view state keeps links valid when the viewport math or filters change.

## Considered Options

**Encode viewport and filters in the URL.** Rejected — links would break whenever either changes shape, and every pan would write history.

**Always load every level for an unresolved slug.** Rejected — most links resolve at level 1–3 and would pay level 4's cost for nothing.
