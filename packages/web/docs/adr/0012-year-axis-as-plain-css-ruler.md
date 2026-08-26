---
status: accepted
---

# Year Axis renders as a plain HTML/CSS ruler, not SVG/D3

## Context

Profiling (`performance_start_trace` against the dev server) traced most of a ~5.9s LCP to the Year Axis: its original D3 `axisBottom` implementation sized its tick count off the entire ~4,776-year scrollable domain regardless of scroll position, producing thousands of DOM nodes up front. A first rewrite kept D3 but windowed the tick join to the visible scroll range (~4.1s LCP) — better, but still one DOM node per rendered tick.

## Decision

The Year Axis is a plain HTML/CSS ruler instead, unlike the rest of `widgets/timeline-canvas` (SVG/D3): tick marks (year/decade/century) are layered CSS background gradients, needing no per-tick DOM node and no windowing at all; only the decade-number labels are a small positioned list, windowed to the live visible scroll range via a throttled scroll listener in `TimelineCanvas.tsx`. `TimelineCanvas.module.css`'s full-height decade gridlines behind the lane content use the same CSS-gradient technique.

## Why

A CSS background-gradient ruler has a fixed cost independent of the domain size or DOM node count — the D3/SVG approach's cost scaled with how many ticks existed in the visible range (or, unwindowed, the entire domain), which is exactly the axis of growth this timeline's ~4,776-year range hits hardest. Moving the tick marks themselves out of the DOM entirely removes that scaling problem rather than just windowing it down.

## Consequences

- Real-measured LCP: ~5.9s → ~4.1-4.4s (the CSS rewrite matched the windowed-D3 rewrite's number, i.e. no regression — the axis's own cost was already the thing eliminated).
- Any future Year Axis change must stay off SVG/D3 — reintroducing a per-tick DOM node (windowed or not) reopens this LCP cost. `packages/web/docs/code-conventions.md` states this as a standing rule.
- Because a CSS-gradient ruler can only tile one repeating phase, and the CE-side and BCE-side tick phases genuinely differ (`docs/adr/0001-astronomical-year-numbering.md`), the ruler and the matching decade-gridline layer both render as two adjacent, independently-phased regions split at year 0 rather than one continuous background.
