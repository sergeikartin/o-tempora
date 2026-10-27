---
status: accepted
supersedes: 0016-url-carries-a-selection-and-arrival-fits-it.md
---

# The URL carries one entity, and arriving through it fits the viewport

## Context

`0016-url-carries-a-selection-and-arrival-fits-it.md` repeated `?e=<slug>` once per Selection member. The Selection is now one entity (`docs/adr/0009-selection-is-one-entity-and-profiles-replace-the-comparison.md`).

## Decision

- `?e=<slug>` names one entity. A link that repeats the param opens the first non-empty slug, and the URL is rewritten to it.
- The slug resolves through the same progressive loading as before: level 3, then level 4, one at a time, while it is missing. The Detail Level rises as far as the entity's Fame Score needs. An unresolved slug is dropped and the timeline opens with no panel.
- History is unchanged: picking an entity from an empty Selection pushes an entry; picking another while the panel is open, and closing, replace it. Back closes the panel in one step. `popstate` re-resolves the slug the URL then holds. The language switch carries the slug.
- Arrival fits the viewport to the entity's span, padded 10% each side and clamped to the 50–250 year zoom limits, against the canvas minus the desktop drawer, and scrolls its mark to the lane's centre. Clicks, Search picks and later changes never change zoom.
- While the Selection is open on desktop the scroll width grows by the drawer's width, as empty space after the present.
- The panel's outside-press check still hit-tests at the pointer position, because a mouse press on the canvas captures the pointer and retargets the release.

## Why

One slug keeps links short and the history rule trivial. Fitting only on arrival keeps a visitor's own zoom stable while a shared link still shows the entity it names.
