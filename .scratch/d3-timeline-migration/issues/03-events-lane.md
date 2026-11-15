# Port Events & Inventions lane

Type: task
Status: resolved
Blocked by: 01

## Task

Add the Events & Inventions lane section to the shared D3 core. Simplest of the three: points only (`discoveries.json` never carries `endYear`), a single flat `category` fill color, no stacking algorithm needed unless real data (24 items) proves otherwise.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `1ee0326` (D3 migration), including shared scrolling, lane rendering, numeric zoom, tests and removal of the vis-timeline dependency and adapters. Later lane merging, row assignment and mark changes are subsequent decisions; this historical migration has no remaining work.
