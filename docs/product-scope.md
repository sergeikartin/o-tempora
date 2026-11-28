# Product Scope

O Tempora helps visitors see whose lives overlapped and what else was happening. Its read-only timeline spans roughly 800 BCE to the present and can extend to 3000 BCE. People, Conflicts and Milestones share one time axis. The project draws on Map of Contemporaries and Wait But Why’s “Horizontal History.”

## Visitor flow

- The Landing Page offers seven switchable Curiosities with dated marks, one action to open each story at its lead entity’s Profile passage, and source and data-license credits.
- The default timeline opens at 1740–1860 and Mainstream. Visitors pan or zoom, adjust Detail Level and combine Occupation, Region, and Conflicts & Milestones filters. Search honors those filters across all four Detail Levels. Results that require a deeper level name it and switch to it when opened.
- A mark or Search pick opens one Selection. The detail panel shows the locale’s Profile when available and the Description otherwise. Entity Links fit to the selected span and can open a Profile passage. Back retraces Connection hops.
- Help explains navigation, marks, colors and Detail Level. Visitors open it with the Top Bar or `?` and use it to reach About, which credits the data and code licenses. The language switch is in the Top Bar.
- English and Russian share the same entities. Phone layouts support both orientations down to roughly 360–390px. [Design](../packages/web/DESIGN.md) · [Routes](deployment.md)

## V1 boundaries

Out of scope are accounts, editing, live external data, a map view, pairwise connection lines, dimming or ranking unselected marks, guided tours, rich media, side-by-side bilingual presentation and additional locales. The timeline URL shares the entity and optional Profile Anchor. Viewport, Detail Level and filters stay local to the visit.

## Launch criteria

Smooth pan and zoom with the default dataset, stable rows in crowded periods, responsive filters, accurate detail panels and correct BCE/CE labels. Cover the top 200 people and a comparable set of events. Both locales share that coverage through per-field English fallback for lane text.
