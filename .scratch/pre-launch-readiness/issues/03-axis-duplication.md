Type: grilling
Status: open
Blocked by: 02

# Reduce YearAxis duplication

## Question

`TimelineCanvas.tsx` currently renders three separate `<YearAxis>` instances at every zoom level — one above the People lane, one between People and Conflicts/Milestones, one below Conflicts/Milestones (`TimelineCanvas.tsx:664,675,692`). Sergei flagged this as likely redundant for a launch-quality layout (chart-the-map grilling session: "Reduce" chosen over "keep all 3").

Resolve:
- How many axis rows survive, and where (top+bottom only? just one?).
- Whether the answer changes once [Years axis: labeled era bands](02-years-axis-eras.md) lands — an era band might functionally replace the middle axis instead of the reduction being a separate, unrelated cut.
- Whether this decision should also account for the mobile layout (already shipped, commit `0b07b26`) — confirm the mobile bottom-sheet/drawer layout doesn't already rely on all three axis instances being present.
