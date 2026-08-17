---
status: accepted
---

# CSS-only animation scope; DetailPanel stays always-mounted for its slide transition

## Context

The timeline lanes (`PeopleLane`, `ConflictsMilestonesLane`) are SVG subtrees d3 owns imperatively: `.join()` sets `.attr()`s directly with no `.transition()` calls, and filtered-out items are removed via synchronous `.exit().remove()`. `DetailPanel` is a plain React-rendered `<div>` that fully unmounts (`if (!selected) return null`) when closed, with `App.tsx` always rendering the component and swapping its `selected` prop.

## Decision

This pass adds CSS-only motion for two surfaces: `DetailPanel` open/close, and hover feedback on lane marks (plus the two pre-existing instant hovers on `Sidebar`'s language switcher and `Minimap`'s viewport rect). Lane-item entry/exit fades (filter/Data Depth changes) and eased zoom transitions are explicitly out of scope for this pass — they'd need d3's own `.transition()`, since a CSS `transition` can't animate an `.exit().remove()` that already happened synchronously, and d3 re-sets SVG geometry attributes (`x1`/`cx`/etc.) directly rather than through `transform`/`opacity`, which are the properties CSS transitions handle reliably.

`DetailPanel` changes from conditionally unmounting to always rendering, with an open/closed CSS class driving a `translateX` slide and `inert` applied while closed (removing it from tab order and the accessibility tree). This avoids timing DOM removal against a CSS transition with a `transitionend` listener or timer.

## Why

DetailPanel is one global singleton drawer (`App.tsx` renders exactly one), not a repeated list item, so always-mounting it costs nothing meaningful and sidesteps an entire class of "did the timer fire before the next click" bugs that a delayed-unmount approach would carry. The lane items are the opposite case — potentially hundreds of DOM nodes — where d3's `.transition()` is the idiomatic, already-in-place mechanism for exactly this problem (enter/update/exit with timing), so it was deferred as its own follow-up decision rather than forced into this pass's "CSS is enough" framing.

## Considered Options

**Delay `DetailPanel`'s unmount with a timer/`transitionend` listener**, keeping the conditional-render shape. Rejected: always-mounting is simpler for a single global drawer, and avoids a listener that has to stay in sync with the CSS duration token.
