# Shared D3 timeline core + People lane

Type: task
Status: open

## Task

Build the real (non-prototype) D3 rendering core: one shared `xScale`/time domain, one shared-horizontal-scroll container hosting three vertically-stacked lane sections in People / Wars & Conflicts / Events & Inventions order — replacing `TimelineCanvas.tsx`'s three-separate-vis-timeline-instances-plus-`rangechange`/reentrancy-guard sync entirely (see `packages/web/docs/adr/0001-d3-over-vis-timeline.md`'s Consequences).

Port the People lane into this core, promoting branch `prototype/d3-people-lane-ticket-01`'s approach — greedy interval-graph row stacking, clip-pathed name labels inside the bar, reign-period bottom-edge stripe — out of prototype status: real component structure/naming (no `PROTOTYPE` markers), real tests. Colors/tokens can stay provisional (prototype-inlined hex) if Unit 5 hasn't landed real CSS-custom-property tokens yet — that's ticket 05, not blocking this one.

Each lane section gets its own independent vertical scroll region for row overflow; the People section is the one that actually needs it (11 rows over 49 real people in the prototype).
