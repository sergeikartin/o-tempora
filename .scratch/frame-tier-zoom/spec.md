# Fame Tier Zoom + Century Year Axis

## Destination

Zoom gains a third, zoom-coupled dimension: three **Fame Tiers** (CORE, NOTABLE, EXHAUSTIVE) that automatically gate entity density as the user zooms, replacing the never-built manual fame-tier selector (Unit 9) outright. The Year Axis gains a second, sticky-in-spirit major header row showing computed century boundaries above the existing minor-tick row.

Originated from a `/grilling` session (`mattpocock-skills:grilling` + `mattpocock-skills:domain-modeling`) against an externally-proposed "Historical Timeline Visualization Architecture" doc, resolved against this repo's actual code and existing decisions. See `packages/web/docs/adr/0002-fame-tier-drives-zoom.md` for the ADR-worthy piece of this (Fame Tier ↔ `FameTier` mapping); `CONTEXT.md` has the "Fame Tier"/`FameTier` glossary split.

## Starting point

- Zoom today: continuous `pixelsPerYear` state in `TimelineCanvas.tsx`, stepped by `+`/`-` buttons (`ZOOM_STEP = 0.2`), bounded by `ZOOM_MIN_YEARS`/`ZOOM_MAX_YEARS` (`shared/config/viewport.ts`). No wheel/pinch zoom.
- Fame filtering today: none at runtime. The data-pipeline (`packages/data-pipeline/src/transform/score.ts`) already defines three nested named tiers per lane (`generalPublic` ⊂ `educated` ⊂ `specialist`, keyed off each entry's `fameScore`) but only ships the `generalPublic`-floor subset — Unit 9 (`features/filter-by-fame-tier`), the planned manual selector for this, was never built.
- Year Axis today: single-row `d3.axisBottom`, positioned between the People and Wars & Conflicts lanes (not at the top) — deliberately, so Wars/Events markers (fixed at `MARKER_CENTER_Y`) read directly against it. Plain signed-integer year labels (`String(year)`, BCE negative), no BCE/CE formatting anywhere.

## Architecture

Decided during grilling — not open for re-litigation here:

- **Fame Tier replaces the fame-tier filter, not additive to it.** No user-facing manual fame control ships. Unit 9 as originally scoped is superseded; remove it from `docs/active-context.md`'s Next Up.
- **Tier bounds are contiguous**, keyed off `pixelsPerYear`-derived visible-years, same mechanism as today's `ZOOM_MIN_YEARS`/`ZOOM_MAX_YEARS` clamping:
  - Tier 1 (CORE): 500y ↔ 150y
  - Tier 2 (NOTABLE): 150y ↔ 50y
  - Tier 3 (EXHAUSTIVE): 50y ↔ 10y
  - `ZOOM_MAX_YEARS` widens from 250 to 500 (`docs/product-scope.md` updated accordingly).
- **No new zoom interaction.** The existing `+`/`-` buttons are the only control; tier is a pure derived value from `pixelsPerYear`, not a separate stateful mode.
- **People lane keeps its fixed 4:1:1 flex ratio** across all tiers — no layout reflow on tier change, existing `overflow-y: auto` absorbs unbounded row count.
- **Fame Tier ↔ FameTier mapping** (see ADR 0002): Tier1→`generalPublic`, Tier2→`educated`, Tier3→`specialist`. Pipeline output floor widens from `generalPublic`-only to `specialist` (full superset ships); frontend filters client-side by each entry's existing `fameScore` against the active tier's threshold (`FAME_TIER_MIN_HPI` for People, `FAME_TIER_MIN_SITELINKS_WARS`/`_DISCOVERIES` for Wars/Events).
- **Active Fame Tier is shown**, read-only, near the zoom controls (e.g. "CORE"/"NOTABLE"/"EXHAUSTIVE" label) — no interaction, purely informational.
- **Year Axis stays in its current position**, between People and Wars & Conflicts. Not moved to the top; no sticky/position:fixed needed (the canvas already has no outer vertical scroll).
- **Minor-tick step keeps D3's default `axisBottom` tick algorithm**, retuned to target 60–80px label spacing. No custom step-snapping function.
- **Major header row is new**: computed, uniform century boundaries only (e.g. "1800s," "3rd century BCE") — arithmetic from the visible year range, no curated named-epoch dataset. Named epochs (Antiquity, Renaissance, etc.) explicitly deferred, not part of this effort.
- **BCE/CE display formatting** ("500 BCE"/"100 CE") applies everywhere a year is shown to the user — the Year Axis *and* the tooltip templates in `map-to-items.ts` (`mapPeople`/`mapWars`/`mapDiscoveries`'s `${startYear}–${endYear}` strings, plus the reign-period tooltip) — via one shared formatting utility, not duplicated per call site. Internal `startYear`/`endYear` representation (signed integer, BCE negative) is unchanged everywhere else — this is presentation-only.

## Scope

**In scope:**
- `packages/data-pipeline`: widen the Wars/Discoveries/People output floor from `generalPublic` to `specialist` in the output stage.
- `packages/shared-types`: republish `wars.json`/`discoveries.json`/`people.json` with the wider floor (no type changes — `fameScore` already exists on `TimelineEntry`).
- `packages/web`:
  - `shared/config/viewport.ts`: `ZOOM_MAX_YEARS` 250 → 500; new Fame Tier boundary constants.
  - New Fame Tier derivation (from `pixelsPerYear`/visible-years) + client-side `fameScore` filtering, applied to all three lanes.
  - New read-only Fame Tier indicator near the zoom controls.
  - `widgets/timeline-canvas/YearAxis.tsx`: new major-header row (computed century boundaries), retuned minor-tick spacing.
  - New shared year-formatting utility (BCE/CE display), wired into `YearAxis` and `map-to-items.ts`'s tooltip strings.
- `docs/product-scope.md`, `docs/active-context.md` (close Unit 9 as superseded), `packages/web/docs/code-conventions.md` (Timeline Rendering section) updated to match.

**Out of scope:**
- Curated named-epoch dataset (deferred — computed century boundaries only, for now).
- Any new zoom interaction (wheel/pinch, tier-pinning shortcuts).
- BCE/CE formatting outside year displays already covered above (no other new surfaces).
- Occupation/region filter changes (unaffected by Fame Tier).

## Tickets

Broken out into `issues/01-widen-pipeline-output-to-specialist-floor.md` through `issues/04-century-major-header-row-on-year-axis.md`. Two independent chains: 01→02 (Fame Tier gating) and 03→04 (Year Axis century headers).
