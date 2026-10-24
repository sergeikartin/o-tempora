---
status: accepted
supersedes: 0008-mobile-layout-reuses-zoom-animation-and-splits-breakpoint-from-input-capability.md (the sidebar drawer parts only)
---

# A Top Bar and a Filters Panel replace the sidebar and its drawer

## Context

The timeline's controls lived in a floating 320px sidebar that covered a quarter of a 1440px canvas, and below 960px the same controls became a left drawer with a scrim and a toggle button over the canvas. `0008-mobile-layout-reuses-zoom-animation-and-splits-breakpoint-from-input-capability.md` made `useIsMobileViewport()` decide, among other things, whether the sidebar renders as a column or a drawer. Search and Detail Level, the two controls used all the time, were hidden behind the drawer on a phone, while the occasional filters took the same prime space on a desktop.

## Decision

- A **Top Bar** (`widgets/top-bar`) sits above the canvas at every width: wordmark, Search, Detail Level, a Filters button with an active-filter count, and Help. About and the language switch moved into the Help panel.
- The Filters Panel (Occupation Domain, Region, Conflicts & Milestones) opens from the Filters button: a popover under it on desktop, a bottom sheet over a scrim at 960px and below. It is the same markup in both; CSS picks the presentation.
- The Top Bar's layout is CSS-only (one row on desktop; at 960px and below, Search, Filters and Help on the first row and Detail Level full width on the second, wordmark hidden), so the prerendered first paint (`0013-prerender-default-viewport-for-lcp.md`) is already right before hydration reads the viewport width.
- The panel is modal on both presentations: it traps focus, closes on Escape or a press outside, and returns focus to the trigger. The trap lives in `shared/lib/useModalFocus.ts`, shared with `ModalPanel`.
- The detail panel on desktop starts below the Top Bar, so Search, Filters and Help stay reachable while a Selection is open. An Escape that closes a modal does not also close the detail panel.
- The Detail Level switch drops its two visible helper lines to fit the bar; the text stays as screen-reader description.
- The left drawer, its scrim, the drawer toggle and the desktop collapse handle are removed. `useIsMobileViewport()` no longer governs the filter UI; it still gates the Minimap.

## Consequences

- The canvas is full width, so nothing covers its left quarter. People labels pin to the scroll container's edge, which needed no change.
- `--top-bar-height` is the one layout constant shared by the bar, the desktop detail panel and the popover's max height.
- Pressing in the Top Bar while a Selection is open still counts as a press outside the detail panel and closes it, as pressing in the sidebar did.
- The part of `0008` about `useIsMobileViewport()` omitting the Minimap, and the pinch and breakpoint-versus-input-capability decisions, stand.

## Considered Options

**Keep Search and Detail Level in a slimmed sidebar on desktop.** Rejected: the column still takes canvas width, and a phone would still need a second arrangement.

**Put every filter in the bar as pills.** Rejected: 22 Region pills do not fit a strip, and the filters are touched occasionally, not continuously.
