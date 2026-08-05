# Timeline Rendering Foundation: vis-timeline vs. D3

Labels: wayfinder:map

## Destination

A locked decision — vis-timeline vs. D3 as the rendering foundation for all three timeline lanes (People, Wars & Conflicts, Events & Inventions) — with rationale recorded as an ADR at `packages/web/docs/adr/`. Migration execution, if D3 is chosen, is a separate follow-on effort — not part of this map.

## Notes

- Domain: `packages/web` frontend, timeline rendering (`widgets/timeline-canvas/`). See `packages/web/docs/code-conventions.md` ("Timeline Rendering (vis-timeline)") for the current vis-timeline integration this decision is evaluating against.
- Skills: ticket 01 via `/prototype`; ticket 02 via `/grilling` + `/domain-modeling` (records the ADR).
- Standing preferences for this effort:
  - Binary comparison only — vis-timeline vs. D3. No active scouting of other libraries; a third option may surface opportunistically but isn't being hunted for.
  - One decision for all three lanes, not a per-lane split.
  - Decided by prototype, not research-first — go straight to building a D3 prototype rather than researching whether vis-timeline can be reconfigured to fix the issues below.
  - Trigger: Unit 5 (People-lane lifespan rendering) grilling session paused mid-session over a vis-timeline limitation — see `docs/active-context.md`.

### Decision drivers (from grilling)

- Custom rendering: custom height and color for the lifespan bar; custom color for reign-period overlays.
- Stacking-collision bug: on initial load, items overlap and names are hidden — likely the same root cause as vis-timeline reserving stacking row-height from its own default item height rather than CSS overrides.
- Client-side render performance — the main performance driver is render time once data has arrived, not fetch latency.
- Interaction: pan via native browser horizontal scroll instead of the current custom drag/`rangechange`-sync approach; zoom stays as the existing +/- buttons (unchanged either way).

## Decisions so far

- **D3**, replacing vis-timeline as the rendering foundation for all three lanes. Decided via `/grilling` off the ticket-01 prototype; recorded as `packages/web/docs/adr/0001-d3-over-vis-timeline.md`. The People-lane prototype was taken as sufficient evidence for Wars & Conflicts and Events & Inventions too (see the ADR's Consequences for why). This map's destination is reached — migration execution is a new, separate, not-yet-specced follow-on effort.

## Not yet specified

<!-- empty — this map is tightly scoped to two tickets; nothing beyond them is in view yet -->

## Out of scope

- Progressive/fame-tier-first data loading (fetch top fame tier first, stream in the rest) — a future data-fetching-strategy idea named during grilling, not part of this rendering-foundation decision.
- Actual migration execution if D3 is chosen — becomes its own follow-on spec/effort once this map closes.
