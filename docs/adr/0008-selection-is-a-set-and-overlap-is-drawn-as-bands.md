---
status: accepted
---

# The Selection is a set of up to four entities, and overlap is drawn as bands, not connections

## Context

The product's job is "who lived at the same time as whom", but overlap was only implied by vertical alignment: one entity could be selected at a time, and `PRODUCT.md` and `docs/product-scope.md` listed connections and "who overlapped" highlighting as out of scope. Visitors reading a pair, such as a physicist who died in the month a founder was born, had to eyeball it across lanes.

## Decision

- The selected entity becomes a **Selection**: up to four entities, in pick order. A plain click or a Search pick replaces it; Shift/Ctrl/Cmd-click, or the floating "Add to comparison" button on the timeline followed by a click, toggles a member. At four, further adds are ignored.
- Overlap is drawn as bands behind the marks of all three lanes: a **Span Band** per member (a Period is a band, a PointInTime a hairline) and an **Overlap Band** for the span every member shares, stronger in tone with a minimum on-screen width. It is a selection state only — no hover, no dimming or ranking of other marks, no lines between marks.
- The shared span is computed once (`computeOverlap`) and used for both the Overlap Band and the detail panel's overlap sentence, so the picture and the words cannot disagree. A PointInTime member counts only if it falls inside every Period; no common span draws nothing and the panel says so.
- Members hidden by Detail Level or filters stay in the Selection with their band; the panel notes it and × removes them.

## Why

Bands read straight down the screen across all lanes, which answers "what else was happening" for each member at once, and they need no per-pair layout. A set bounded at four keeps the bands and the panel list legible.

## Considered Options

**Pairwise connection lines between marks.** Rejected: lines cross lanes and rows, collide with labels at density, and grow quadratically with the Selection.

**Dim or rank unselected marks.** Rejected: it reorders what the visitor is reading and fights the Detail Level as the one control over density.

**Hover-driven overlap.** Rejected: invisible on touch, and a hover cannot be shared as an Entity Link.

This reopens the earlier scope call that left "who overlapped" highlighting and comparison out of v1.
