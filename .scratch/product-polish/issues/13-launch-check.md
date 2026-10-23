Type: task
Status: needs-info
Blocked by: 12

Re-run the 2026-10-22 live-site audit's method against the result: headless Chromium (Playwright) against production at 1440×900, 768×1024 and 390×844 (touch), EN and `/ru/`; axe-core; PerformanceObserver for LCP and CLS; manual screenshot review.

## Acceptance

- axe: no serious or moderate violations on all six combinations, for the landing and the timeline.
- LCP and CLS no worse than before (0.7–1.2 s, 0) on both pages.
- No Mixed Content warnings, no failed requests, no stock 404.
- Starting Point ids all resolve at `Mainstream`.
- Cover what the first audit did not: the filter drawer/sheet on phone, zoom controls in motion, zero-result filter states, Detail Levels beyond `Mainstream`.

Write the findings to `.scratch/product-polish/research/launch-check.md`.
