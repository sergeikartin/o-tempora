# Decide: vis-timeline vs. D3, record ADR

Type: grilling
Status: closed — decided D3. ADR: `packages/web/docs/adr/0001-d3-over-vis-timeline.md`
Blocked by: 01

## Question

Given the D3 People-lane prototype (ticket 01) and the current vis-timeline behavior it's being compared against, decide: does `packages/web` move to D3 as the rendering foundation for all three lanes (People, Wars & Conflicts, Events & Inventions), or stay on vis-timeline?

Weigh it against the decision drivers from the map's Notes: custom bar/reign-period styling, the stacking-collision bug, client-side render performance, and native-scroll panning.

Use `/grilling` + `/domain-modeling` to reach and record the decision. Write the ADR to `packages/web/docs/adr/` (directory doesn't exist yet — create it). Note that the prototype only covers the People lane; the decision applies to all three lanes per the map's destination, so the ADR should say explicitly why the People-lane prototype is taken as sufficient evidence for Wars & Conflicts and Events & Inventions too (or what, if anything, still needs checking there).
