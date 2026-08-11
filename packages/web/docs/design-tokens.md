# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

**Design concept:** warm, paper-like page with pastel colors distinguishing entries (set by reference image `greece-view.png`). Color encodes **milestone category** (Milestones) or **occupation domain** (People); Conflicts render in one flat color instead (see Conflict Color below) — never person-vs-event, which is carried by lane and label position instead (People's label above its line, Conflicts'/Milestones' below their marker) plus, within the merged Conflicts+Milestones lane, color itself (flat Conflict Color vs. Milestones' multi-color palette). Shape carries Period vs. PointInTime instead, the same across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Filter chips and timeline entries share the same color end-to-end within each lane. `MilestoneCategory` and `OccupationDomain` are separate enums from separate sources (hand-curated, Pantheon) with separate palettes below — see `CONTEXT.md` for why they aren't unified. `ConflictCategory` still exists as curator-assigned data (see `CONTEXT.md`) but no longer drives a color.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F3EEDD` | Page background |
| `color-bg-surface` | `#FBF8F0` | Filter bar, sidebar, event point-markers, detail/tooltip panel |
| `color-bg-surface-raised` | `#FFFFFF` | Filter chips, filter pills |
| `color-border-subtle` | `#DED3B8` | Default borders, dividers |
| `color-border-strong` | `#C9B98F` | Hover/active borders |
| `color-text-primary` | `#2E2B22` | Primary text |
| `color-text-secondary` | `#83795F` | Secondary/muted text |
| `color-accent-selected` | `#B8842E` | Selected entity, viewport indicator, focus ring |
| `color-focus-ring` | `#8C5A1E` | Keyboard focus outline |

## Conflict Color

Used as the stroke/fill color for every Conflict's range line and point-dot marker, regardless of `ConflictCategory`. Retired the old per-category Conflict Category Palette (six hues keyed by `ConflictCategory`) once Conflicts and Milestones merged into one mixed, fame-ranked lane (`packages/web/src/widgets/timeline-canvas/ConflictsMilestonesLane.tsx`) — a Conflict needs to read as one visual group at a glance next to Milestones' own multi-color palette below, not blend into it category-by-category. Reuses the old palette's War hex, its warmest/most-recognizable entry.

| Token | Hex |
|---|---|
| `color-conflict` | `#BF696B` |

## Occupation Domain Palette

People-lane only. Keyed by Pantheon's `OccupationDomain` (a different enum and source than the flat Conflict Color above, or Milestones' own category palette). Used as the stroke color on People-lane lifespan lines. Values are lifted verbatim from pantheon.world's own CSS custom properties (`--colorInstitutions` etc.) rather than derived, so the legend matches Pantheon's source exactly.

| Domain | Token | Hex |
|---|---|---|
| Institutions | `color-domain-institutions` | `#B12D11` |
| Arts | `color-domain-arts` | `#D28629` |
| Business & Law | `color-domain-business-law` | `#4F680A` |
| Public Figure | `color-domain-public-figure` | `#67AF8C` |
| Science & Technology | `color-domain-science-technology` | `#0E5E5B` |
| Exploration | `color-domain-exploration` | `#4C5ED7` |
| Humanities | `color-domain-humanities` | `#732945` |
| Sports | `color-domain-sports` | `#BB3B57` |

## Typography

| Role | Typeface |
|---|---|
| Display | Fraunces (serif, variable) — app title only |
| Body / UI | Inter — all UI chrome and entry labels |
| Data / Dates | IBM Plex Mono — year ranges and dates (tabular figures) |

## Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-full` | `9999px` | Filter chips |
| `radius-sm` | `6px` | Event point-markers |
| `radius-md` | `8px` | Not currently consumed by `widgets/timeline-canvas` — Period lines (People, Conflicts) use `stroke-linecap: round` for their rounded caps instead of a corner radius |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
