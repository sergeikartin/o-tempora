Type: grilling
Status: resolved

# Reduce YearAxis duplication

## Question

`TimelineCanvas.tsx` currently renders three separate `<YearAxis>` instances at every zoom level — one above the People lane, one between People and Conflicts/Milestones, one below Conflicts/Milestones (`TimelineCanvas.tsx:664,675,692`). Sergei flagged this as likely redundant for a launch-quality layout (chart-the-map grilling session: "Reduce" chosen over "keep all 3").

Resolve:
- How many axis rows survive, and where (top+bottom only? just one?).
- Whether the answer changes once [Years axis: labeled era bands](02-years-axis-eras.md) lands — an era band might functionally replace the middle axis instead of the reduction being a separate, unrelated cut.
- Whether this decision should also account for the mobile layout (already shipped, commit `0b07b26`) — confirm the mobile bottom-sheet/drawer layout doesn't already rely on all three axis instances being present.

## Answer

Resolved directly (via `/grill-with-docs`) rather than waiting on [02](02-years-axis-eras.md): only the middle `<YearAxis>` instance survives — the top and bottom instances are deleted outright, not just hidden. The middle instance was already the one row-order/importance is measured against (`personLabelYForRow`), so it's the natural sole survivor.

None of the three instances were ever needed to stay visible during a lane's own vertical scroll — `.peopleLane`/`.conflictsMilestonesLane` each scroll internally in their own capped `overflow-y` box, so the axis rows were never at risk of scrolling out of view regardless of count. That removes the concern that motivated keeping three in the first place; there was no real trade-off being given up.

Mobile is unaffected either way: none of the three `<YearAxis>` instances or the gridline layer are `isMobileViewport`-gated (only the Minimap itself is desktop-only), so the reduction to one applies identically on both breakpoints.

[02](02-years-axis-eras.md) (labeled era bands, e.g. "Renaissance") stays open and unrelated — this reduction doesn't presuppose or block that separate feature.

The freed ~76px of page height (2 × `AXIS_HEIGHT`) funds the Minimap's height increase for its new century-marks strip (see [11](11-rename-mountain-profile-to-minimap.md)/[13](13-minimap-century-marks.md)), with any remainder going to the lanes (keeping their existing 4:2 People/Conflicts+Milestones ratio).

**Ready for agent:**
- [x] Top and bottom `<YearAxis>` instances removed from `TimelineCanvas.tsx` (component usage and the layout gap they occupied); only the middle instance remains.
- [x] Freed vertical space is allocated per the note above: first to the Minimap's height increase ([13](13-minimap-century-marks.md)), remainder to the lanes at their existing 4:2 ratio — automatic via flexbox once the two `flex: 0 0 auto` axis rows were removed, no explicit height math needed.
- [x] Tests referencing the removed instances (`TimelineCanvas.test.tsx`, `TimelineCanvas.mobile-viewport.test.tsx`) updated.

Implemented: `typecheck`/`test`/`lint`/`lint:boundaries` all pass; verified visually in-browser (desktop and mobile viewports).
