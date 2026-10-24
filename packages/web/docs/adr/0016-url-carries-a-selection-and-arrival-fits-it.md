---
status: accepted
supersedes: 0015-entity-only-url-state-with-progressive-loading.md
---

# The URL carries a Selection, and arriving through it fits the viewport

## Context

`0015-entity-only-url-state-with-progressive-loading.md` made `?e=<slug>` the only URL state and opened a single entity. A Selection (`docs/adr/0008-selection-is-a-set-and-overlap-is-drawn-as-bands.md`) holds up to four, and the landing page needs one link that opens every mark of a Curiosity. Opening a link also used to keep the current zoom, which left a multi-entity link showing only part of what it names.

## Decision

- `?e=<slug>` repeats once per member, in selection order. At most four are read, repeats and empty values are ignored, and the URL is rewritten to what actually opened.
- Slugs resolve through the same progressive loading as before: level 3, then level 4, one at a time, while any slug is missing. The Detail Level rises as far as the least famous resolved entity needs. Unresolved slugs are dropped; with none left the timeline opens with no panel.
- History: the first entity picked from an empty Selection pushes an entry; adding or removing while a Selection is open, and closing, replace it. Back from any Selection therefore closes the panel in one step. `popstate` re-resolves whatever slugs the URL then holds. The language switch carries every slug.
- Arrival fits the viewport to the union of the members' spans, padded 10% each side and clamped to the 50–250 year zoom limits, against the canvas minus the 340px desktop drawer. Clicks, Search picks and later Selection changes never change zoom.
- While a Selection is open on desktop the scroll width grows by the drawer's width, as empty space after the present, so spans near today can be centred in the uncovered part.
- The panel's outside-press check hit-tests at the pointer position rather than reading the event target, because a mouse press on the canvas captures the pointer and retargets the release; otherwise a Shift-click would close the Selection it was about to extend.

## Why

Repeated `e` params keep links readable and order-preserving and need no new encoding. Replacing history after the first push is what makes Back close a Selection in one step instead of unwinding each add. Fitting only on arrival keeps a visitor's own zoom stable while they work, while a shared link still shows everything it names.

## Considered Options

**Push an entry per Selection change.** Rejected: Back would walk through every add and remove.

**Always fit on every change.** Rejected: it would override a zoom the visitor chose.

**Clamp the fit at the present instead of adding slack.** Rejected: spans near the present, the common case, would sit under the drawer.
