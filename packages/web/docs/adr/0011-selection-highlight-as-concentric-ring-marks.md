---
status: accepted
---

# Selection/search-jump highlight renders as concentric duplicate marks, not a CSS filter

## Context

Selecting a mark (click, or landing on one via a search jump — `e00a6b0`) needs a highlight that reads clearly against every lane's palette and against both Period lines and PointInTime dots. The first implementation applied a `filter: drop-shadow(0 0 4px var(--color-accent-selected))` stacked 16 times (to approximate an even outline) directly on the selected SVG element, plus a flat recolor for dots.

This broke down on horizontal lines: SVG's `drop-shadow` filter region clips to the filtered element's own bounding box by default, and a thin horizontal `<line>`'s bounding box has near-zero height — the vertically-offset shadow copies had almost no box to render into, so the glow clipped to almost nothing exactly where Period marks (the majority of marks — every Person, every ranged Conflict) needed it most. It also always used the same oxblood accent as the viewport indicator and focus ring, so a selected mark on an already-oxblood-toned lane (Conflicts, or a Public Figure/Institutions People line) had no color contrast to lean on.

## Decision

Selection state no longer applies a filter to the existing mark. Instead, each selected mark draws two additional concentric copies of itself behind the real one: an outer ring in a dedicated `--color-accent-selection-ring` bronze (`#866F2C`), and a `--color-bg-base` (parchment) gap ring between it and the mark, so the bronze never touches the mark's own color directly — the gap ring is what keeps the highlight legible against a lane hue that already sits close to bronze. This applies uniformly to both shapes: a duplicated `<line>` for Period marks, a duplicated `<circle>` for PointInTime dots, across People and Conflicts/Milestones alike.

Selecting a mark also grows it to its existing hover size permanently, and recolors its label to the same bronze as the ring — a click is treated as "a hover that stuck," so hovering an already-selected mark only changes color, not size. The label itself renders at normal weight (not bold): the display face isn't a variable font, so a bold cut has a wider glyph run than the regular cut, and the extra width read as label reflow/jitter on selection rather than emphasis (`7872974`) — the bronze fill and hover-grow scale already carry the emphasis on their own.

## Why

Concentric duplicate marks are real geometry with their own bounding boxes, sized off the same coordinates as the original mark — the SVG filter-region clipping failure mode doesn't apply, because nothing here depends on a filter's bounding-box inference. A dedicated selection color (rather than reusing the oxblood accent) is what makes the ring stay visibly distinct regardless of which lane or occupation-domain color is under it, and the parchment gap ring is a cheap way to guarantee separation without hand-tuning contrast per underlying hue.

## Consequences

- Any new mark shape added to a lane needs its own duplicated-ring pair (line/circle today) rather than being able to reuse a shared filter-based highlight.
- `--color-accent-selected` (oxblood) is scoped back to the viewport indicator and focus ring only; a selected timeline mark never uses it.
- `packages/web/docs/design-tokens.md`'s Color Palette table carries `--color-accent-selection-ring` alongside the existing accent/focus tokens.
