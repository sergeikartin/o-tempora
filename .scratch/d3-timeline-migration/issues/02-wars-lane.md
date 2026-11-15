# Port Wars & Conflicts lane

Type: task
Status: resolved
Blocked by: 01

## Task

Add the Wars & Conflicts lane section to the shared D3 core from ticket 01. Simpler than People: range bars when `endYear` is set, points otherwise; a single flat `category` fill color; no reign-period-style overlay; no subgroup-overlap logic.

Reuse ticket 01's row-assignment function regardless of whether real `wars.json` (18 items) actually produces overlaps — don't special-case it away preemptively just because the dataset is small.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `1ee0326` (D3 migration), including shared scrolling, lane rendering, numeric zoom, tests and removal of the vis-timeline dependency and adapters. Later lane merging, row assignment and mark changes are subsequent decisions; this historical migration has no remaining work.
