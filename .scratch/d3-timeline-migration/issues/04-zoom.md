# Zoom under D3

Type: task
Status: resolved
Blocked by: 01

## Task

Replace the vis-timeline-specific `Timeline.zoomIn()`/`zoomOut()` calls in `TimelineCanvas.tsx` with a D3-native implementation: a numeric zoom-level (pixels-per-year) state shared across all three lanes (they share one horizontal scroll position), driving a re-render of the shared core's `xScale`. Preserve the existing `zoomMin`/`zoomMax` bounds (`shared/config/viewport.ts`) and the existing +/- button UI/behavior.

This was explicitly deferred by ADR 0001 and never prototyped — genuinely new work, not a port.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `1ee0326` (D3 migration), including shared scrolling, lane rendering, numeric zoom, tests and removal of the vis-timeline dependency and adapters. Later lane merging, row assignment and mark changes are subsequent decisions; this historical migration has no remaining work.
