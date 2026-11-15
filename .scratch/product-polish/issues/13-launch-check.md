Type: task
Status: ready-for-agent
Blocked by: 12

Re-run the 2026-10-22 live-site audit's method against the result: headless Chromium (Playwright) against production at 1440×900, 768×1024 and 390×844 (touch), EN and `/ru/`; axe-core; PerformanceObserver for LCP and CLS; manual screenshot review.

## Acceptance

- axe: no serious or moderate violations on all six combinations, for the landing and the timeline.
- LCP and CLS no worse than before (0.7–1.2 s, 0) on both pages.
- No Mixed Content warnings, no failed requests, no stock 404.
- Every Curiosity mark resolves at `Mainstream`.
- Cover what the first audit did not: the filter drawer/sheet on phone, zoom controls in motion, zero-result filter states, Detail Levels beyond `Mainstream`.

Write the findings to `.scratch/product-polish/research/launch-check.md`.

## Comments

Tracker reconciliation (2026-11-15): The scope is specified; this is waiting on ticket 12, not on missing information. No `research/launch-check.md` exists. Run the stated audit after that dependency resolves, against both page kinds at all three widths in both locales. The Mainstream-resolution guarantee is also still tracked in [ticket 14](14-landing-gaps.md).
