---
status: accepted
---

# Mobile layout reuses the zoom-animation transform for pinch, and splits width breakpoint from input capability

## Context

The app had no width-based responsive behavior and no touch-specific handling beyond gating mouse-only drag-to-pan off for touch (native swipe-to-scroll covers it instead). Bringing the app to phone widths (`.scratch/mobile-responsive-layout/spec.md`) required two decisions future readers would otherwise have to reconstruct: how pinch-to-zoom should be implemented given the zoom-button animation's own documented performance history, and how "narrow viewport" and "touch input" should relate to each other.

## Decision

**Pinch reuses the button-zoom's transform-based animation architecture.** Pinch tracking (`TimelineCanvas.tsx`'s `handlePinchPointerDown`/`Move`/`endPinch`) drives the same `applyZoomAnimationTick`/`zoomAnimationGroupTransform` path the `+`/`-` buttons' rAF loop already uses — every mark stays drawn at the gesture's starting `pixelsPerYear` while a single `translate(tx) scale(sx)` group transform per lane/axis tracks the live pinch distance, and the real `pixelsPerYear` state commits exactly once, at gesture end (the second-to-last pointer's `pointerup`). It does not recompute `pixelsPerYear` (and re-render every mark) on each `pointermove`.

**Layout breakpoint (width) and input capability (touch) are two independent axes**, not one conflated "is this mobile" check. `shared/lib/viewport.ts`'s `useIsMobileViewport()` (a `matchMedia(max-width: ...)` subscription) drives what renders — the sidebar drawer/bottom-sheet layout, whether the Mountain Profile mounts at all, the drawer toggle button. A separate `@media (pointer: coarse)` CSS check drives which zoom affordance shows — the `+`/`-` buttons vs. pinch — independent of viewport width.

## Why

**Pinch's animation approach:** `options.ts`'s existing comment on `ZoomAnimationTransform` documents that a full per-mark re-render during a zoom gesture was measured at 250-530ms/frame at this app's density — 15-30x over the 16ms frame budget — which is exactly what a naive pinch implementation (recomputing `pixelsPerYear` and re-rendering on every `touchmove`) would reintroduce, at higher event frequency than clicks. Reusing the already-solved transform path avoids re-discovering that regression under a different gesture.

**Splitting the two axes:** A touch-capable tablet wide enough to clear the layout breakpoint should still get pinch instead of a zoom button that silently does nothing under a touch pointer — coupling "narrow" and "touch" into one flag would force that tablet into either the cramped mobile layout (to get pinch) or a dead button (to keep the desktop layout). Keeping them separate lets each vary on its own real-world axis: screen size drives layout, input hardware drives which zoom control renders.

## Considered Options

**Drive `pixelsPerYear` state directly from `touchmove`**, mirroring the naive approach the button-zoom's own animation history already rejected. Rejected for the frame-cost reason above — pinch fires far more `pointermove` events per gesture than a button click fires zoom clicks.

**One combined `isMobile` flag** (width OR touch) instead of two independent checks. Rejected per the tablet case above — it would make "wide touch device" and "narrow phone" indistinguishable, when they need different layout treatment (desktop column vs. drawer) but the same zoom-control treatment (pinch, not buttons).

## Consequences

- Pinch math (distance → `pixelsPerYear`, midpoint → `centerYear`) is exposed as pure functions in `options.ts` (`pinchPixelsPerYear`, `pinchCenterYear`) alongside `zoomIn`/`zoomOut`, unit-testable without simulating real multi-touch pointer events.
- A wide touch tablet keeps the desktop sidebar/detail-panel/Mountain-Profile layout but loses the `+`/`-` buttons in favor of pinch — an intentional asymmetry between the two axes, not a bug.
- `MOBILE_BREAKPOINT_PX` (640) is a width-only threshold; retuning it doesn't affect which zoom control renders on any given device, and vice versa for `pointer: coarse`.
