# Map: Sidebar with Legend + Fame Filters

Labels: wayfinder:map

## Destination

A sidebar, always visible alongside the timeline, shipped for all users (not a debug tool), with two sections:

- **Legend** — pill-shaped chips showing People's 8 `OccupationDomain` colors (`DOMAIN_COLORS` in `packages/web/src/widgets/timeline-canvas/options.ts`). Visual only for now — not clickable — but styled so click-to-filter is a cheap follow-on later. Wars/Discoveries' `CATEGORY_COLORS` are out of scope for the legend.
- **Filters** — one raw-`fameScore` numeric floor per lane (People/Wars/Discoveries), directly settable by the user. This **fully replaces** the zoom-coupled Fame Tier system (`packages/web/docs/adr/0002-fame-tier-drives-zoom.md`) for end users: zoom goes back to controlling only time-scale, not entity density. The existing read-only `fameTierIndicator` next to the zoom buttons is removed. Defaults on load match today's CORE-tier values (People HPI≥90, Wars sitelinks≥100, Discoveries sitelinks≥200), so first paint is unchanged. Settings are session-only — no persistence.

Reaching this destination includes authoring a new ADR (`packages/web/docs/adr/0003-...md`) documenting the ADR-0002 reversal — same pattern `0001`/`0002` set.

## Notes

- Domain: `packages/web` frontend. Relevant existing code: `TimelineCanvas.tsx` (owns `activeFameTier`/`fameTierForViewport`, the three `filterByFameScore` calls, the `fameTierIndicator` span to be removed), `shared/config/viewport.ts` (`FAME_TIER_*` tables, zoom-coupled — becomes dead weight for end-user filtering once this lands, though the pipeline-side tier concept in `packages/data-pipeline` is untouched), `widgets/timeline-canvas/options.ts` (`DOMAIN_COLORS`, `CATEGORY_COLORS`).
- Skills: `/prototype` for ticket 01; `/grilling` + `/domain-modeling` for ticket 02 (also where the ADR gets recorded, per the `timeline-rendering-foundation` map's pattern).
- Real `fameScore` ranges per lane, gathered directly while charting (no research ticket needed — trivial local JSON read, not the kind of fact-finding `/research` exists for):
  | Lane | Field basis | Min | Max | Median | n |
  |---|---|---|---|---|---|
  | People | Pantheon HPI | 75.0 | 100 | 78.4 | 3,680 |
  | Wars & Conflicts | Wikidata sitelinks | 30 | 193 | 40 | 771 |
  | Events & Inventions | Wikidata sitelinks | 50 | 386 | 68 | 806 |

  Today's CORE-tier defaults (90 / 100 / 200) sit inside these ranges, confirming they're valid starting floors.
- Standing preferences for this effort, settled during destination-grilling (2026-08-06):
  - Single floor per lane, not a min/max range.
  - Raw `fameScore` number, not the CORE/NOTABLE/EXHAUSTIVE tier vocabulary.
  - Full replace of zoom-coupling, not coexistence or an additive ceiling.
  - Session-only settings, no persistence.

## Decisions so far

- Both tickets 01 and 02 resolved by direct `/implement` rather than through `/prototype` then `/grilling` — the user redirected past both when asked how to proceed with ticket 01's missing prototype. See each ticket's `## Answer` for what was decided inline instead, and `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md` for the recorded outcome (ADR 0002 marked superseded).

## Not yet specified

- Legend pills becoming clickable occupation filters — explicitly named as a future direction by the user ("later can be made clickable"), but not sharp enough to ticket: what filtering semantics (single-select? multi-select toggle? AND/OR with the Fame floor?) aren't decided.
- Sidebar responsive/mobile behavior — unexamined; unclear whether the app targets narrow viewports at all today.

## Out of scope

- Reconciling `docs/active-context.md`'s in-progress performance plan (deferring NOTABLE/EXHAUSTIVE-tier entries until the user zooms in far enough) with fame filtering no longer being zoom-driven — that plan's premise breaks once this map lands. Flagged as a real gap, not solved here; belongs to a future, separate performance effort once someone re-derives a fame-floor-keyed (rather than zoom-keyed) progressive-loading strategy.
