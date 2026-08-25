Type: prototype
Status: resolved

# Years axis: labeled era bands

## Question

Sergei's "better years axis (eras?)" resolved (chart-the-map grilling session) to: add a band/row of labeled historical-period markers (e.g. "Renaissance", "Cold War") alongside the existing numeric BCE/CE tick axis (`YearAxis.tsx`), rather than just reformatting the numeric ticks.

This is a "how should it look/behave" question — use `/prototype` to raise fidelity before deciding, per the map's Notes.

Resolve:
- What era taxonomy/boundaries to use (a fixed hardcoded list, matching the project's "no live data" constraint — see `docs/product-scope.md`)?
- Visual placement: a new row, or overlaid on an existing `YearAxis` instance?
- How era bands behave across zoom levels (collapse/merge when zoomed out far enough that individual eras would be unreadably thin; disappear entirely past some zoom threshold?).
- How this interacts with [Reduce YearAxis duplication](03-axis-duplication.md) — an era band might end up replacing one of the three current axis rows rather than adding a fourth.

## Answer

Skipped — Sergei judged labeled era bands an unnecessary complication for v1. Not implemented; the existing numeric BCE/CE `YearAxis` ticks stand as-is.
