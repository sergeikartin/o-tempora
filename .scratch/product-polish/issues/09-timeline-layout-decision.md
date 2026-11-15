Type: prototype
Status: superseded

Original proposal: decide the timeline screen layout. Deferred by the owner during grilling, then replaced by the later Top Bar decision noted below.

## Original candidates

- A: Top bar with always-visible filters in lane gutters; costs canvas width and needs a phone arrangement.
- B: Command bar with one Filters popover, a full-width canvas and a phone bottom sheet.
- C: Floating cards for controls, lanes and Minimap, following the reference site's composition.

## Do

- Build throwaway hi-fi prototypes on the real app's tokens and fonts (static mock data is fine) for the candidates, at 1440×900 and 390×844, EN and RU. The `prototype` skill applies.
- Questions the owner wants answered: where do Occupation and Region live, where is Detail Level, where do lane labels and the Help "?" go, what happens to the Minimap and +/− zoom on phone, and does the big Viewport Range heading stay.
- Evaluate against: no clipped marks, canvas width, discoverability of filters for a first-timer, phone usability at 360–390 px, how Russian strings fit.

## Output

The chosen layout, the rejected ones and why, appended under `## Answer`. A root or `packages/web` ADR (supersedes the sidebar-era decisions) is written with ticket 10, not here.

## Comments

Tracker reconciliation (2026-11-15): Replaced by the later [Top Bar and Filters Panel ticket](../../overlap-and-navigation/issues/02-top-bar-and-filters-panel.md), resolved in `a5047ca`, and web ADR 0017. It settles the full-width canvas, filter popover/bottom sheet and Help placement. The phone [Scrubber](../../overlap-and-navigation/issues/03-phone-scrubber.md) is also resolved. The later layout uses pinch zoom on touch devices rather than the original always-visible phone +/- requirement; do not revive that requirement or the prototype decision. Remaining visual and accessibility review stays in tickets 07 and 12.
