Type: grilling
Status: open

# Vertical hover-indicator: rethink the approach

## Question

The vertical guide-line feature (hovering the Minimap draws a line spanning all lanes/axes at that year — `Minimap.tsx`, `TimelineCanvas.tsx`, `TimelineCanvas.module.css`) was built (commit `45730f0`) and reverted the same day (commit `b1e370b`), with no rationale recorded in either commit message.

Sergei confirmed (chart-the-map grilling session) this isn't a "just re-add it" case — something about the original approach didn't sit right and it needs a fresh design pass before it comes back, not a mechanical re-apply of the reverted diff.

Resolve:
- What specifically was wrong with the original implementation (visual clutter against the minimap / lane density, performance, interaction feel, something else)?
- What should the redesigned version actually look/behave like?
- Should it reuse the reverted commit's mechanism (`onHoverYearChange` reporting up, `TimelineCanvas` owning the line render) or take a different technical approach?
