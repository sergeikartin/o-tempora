# Zoom under D3

Type: task
Status: open
Blocked by: 01

## Task

Replace the vis-timeline-specific `Timeline.zoomIn()`/`zoomOut()` calls in `TimelineCanvas.tsx` with a D3-native implementation: a numeric zoom-level (pixels-per-year) state shared across all three lanes (they share one horizontal scroll position), driving a re-render of the shared core's `xScale`. Preserve the existing `zoomMin`/`zoomMax` bounds (`shared/config/viewport.ts`) and the existing +/- button UI/behavior.

This was explicitly deferred by ADR 0001 and never prototyped — genuinely new work, not a port.
