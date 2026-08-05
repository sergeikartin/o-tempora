# Port Wars & Conflicts lane

Type: task
Status: open
Blocked by: 01

## Task

Add the Wars & Conflicts lane section to the shared D3 core from ticket 01. Simpler than People: range bars when `endYear` is set, points otherwise; a single flat `category` fill color; no reign-period-style overlay; no subgroup-overlap logic.

Reuse ticket 01's row-assignment function regardless of whether real `wars.json` (18 items) actually produces overlaps — don't special-case it away preemptively just because the dataset is small.
