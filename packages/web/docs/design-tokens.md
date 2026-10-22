# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

Visual style guide (Artifact, mirrors this doc): https://claude.ai/code/artifact/a7a65576-55d0-4602-b113-7b178bdb0a57

**Design concept ("Ledger & Ink"):** a parchment-and-ink page — aged paper, iron-gall text, one sharp accent (oxblood) standing in for a wax seal — with color distinguishing entries within that warm neutral base. Color encodes **milestone category** (Milestones) or **occupation domain** (People); Conflicts render in one flat color instead (see Conflict Color below) — never person-vs-event, which is carried by lane and label position instead (People's label above its line, Conflicts'/Milestones' range labels below their line, point labels to the right of their dot) plus, within the merged Conflicts+Milestones lane, color itself (flat Conflict Color vs. Milestones' multi-color palette). Shape carries Period vs. PointInTime instead, the same across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Filter chips and timeline marks share the same color end-to-end within each lane; entry labels are always ink (`color-text-primary`), never the mark's color, so the bar or dot alone carries the category. `MilestoneCategory` and `OccupationDomain` are separate enums from separate sources (hand-curated, Pantheon) with separate palettes below — see `CONTEXT.md` for why they aren't unified. `ConflictCategory` still exists as curator-assigned data (see `CONTEXT.md`) but no longer drives a color.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F2E9D2` | Page background (parchment) |
| `color-bg-surface` | `#FBF6E9` | Filter bar, sidebar, event point-markers, detail/tooltip panel (ledger) |
| `color-bg-surface-raised` | `#FFFFFF` | Filter chips, filter pills |
| `color-border-subtle` | `#E0D3AC` | Default borders, dividers |
| `color-border-strong` | `#C7B383` | Hover/active borders |
| `color-border-control` | `#837757` | Borders of interactive controls (filter pills, search input, switch dots, zoom/drawer/collapse buttons) — 3.7:1 on `color-bg-base`, 4.4:1 on `color-bg-surface-raised`; hover steps to `color-text-secondary` |
| `color-border-emphasis` | `#837757` | Year Axis's century tick mark (darkest of its three tick layers) |
| `color-text-primary` | `#241A10` | Primary text (ink) |
| `color-text-secondary` | `#6B6046` | Secondary/muted text (faded ink) |
| `color-accent-selected` | `#8A2A1A` | Viewport indicator, focus ring (oxblood) |
| `color-selection-halo` | `#241A10` at 14% | The timeline's selected/search-jumped entity halo — a translucent ink fill behind the mark, extending 8px past it, so it reads against every lane hue without a gap band (`docs/adr/0014-ink-selection-halo.md`) |
| `color-focus-ring` | `#6E2013` | Keyboard focus outline |
| `color-bg-axis` | `#EBDDBD` | Year Axis ruler background — a shade darker than the page so it reads as a distinct bar |

## Conflict Color

Used as the stroke/fill color for every Conflict's range line and point-dot marker, regardless of `ConflictCategory`. Retired the old per-category Conflict Category Palette (six hues keyed by `ConflictCategory`) once Conflicts and Milestones merged into one mixed, fame-ranked lane (`packages/web/src/widgets/timeline-canvas/ConflictsMilestonesLane.tsx`) — a Conflict needs to read as one visual group at a glance next to Milestones' own multi-color palette below, not blend into it category-by-category. Rhymes with the People-domain Institutions hue (state power), stepped darker — see Milestone Category Palette below for the same treatment applied to each Milestone group. Wired as a CSS custom property (`--color-conflict`, `global.css`) for CSS-side consumers like `Minimap.module.css`'s SVG fill; the lane rendering itself still reads the plain `CONFLICT_COLOR` JS constant below, since D3 sets that as an SVG presentation attribute directly rather than through CSS.

| Token | Hex |
|---|---|
| `color-conflict` | `#8C2D2B` |

## Occupation Domain Palette

People-lane only. Keyed by Pantheon's `OccupationDomain` (a different enum and source than the flat Conflict Color above, or Milestones' own category palette). Used as the stroke color on People-lane lifespan lines and the sidebar legend swatch. Re-derived from Pantheon's source hues, muted into the Ledger & Ink chroma range (most sit at or just above the OKLCH chroma floor — as desaturated as they can go before reading as gray) and ordered so every adjacent pair in the table below clears the CVD-safety checks — this is also the order the sidebar legend should render in; reordering it re-opens the adjacency question. Lightness is set so every domain color holds at least 3:1 against the parchment surface at `mark-opacity-resting`, and adjacent pairs stay separable under simulated protanopia/deuteranopia; this works because color here is never the only identity channel (label, lane, and line-vs-dot shape carry it too, same principle the Design Concept above states).

| Domain | Token | Hex |
|---|---|---|
| Sports | `color-domain-sports` | `#9A5C73` |
| Business & Law | `color-domain-business-law` | `#347830` |
| Humanities | `color-domain-humanities` | `#4E4993` |
| Institutions | `color-domain-institutions` | `#B6514C` |
| Exploration | `color-domain-exploration` | `#3E70B0` |
| Arts | `color-domain-arts` | `#A85A3D` |
| Science & Technology | `color-domain-science-technology` | `#357B5C` |
| Public Figure | `color-domain-public-figure` | `#8E672C` |

## Milestone Category Palette

Milestones-only, keyed on `MilestoneCategory`. The taxonomy stays all 22 values for filtering, tooltips, and filter-chip labels — only *color* folds it down to 2 legible groups, each one a darker, richer step of the People-domain hue its content actually echoes (same pigment, different register: People reads as the lit, vivid layer; Conflicts/Milestones as the darker ink marking what happened). This set, together with the flat Conflict Color above, is small enough (3 colors) to validate *every* pair against every other, not just neighbors — and unlike the Occupation Domain palette above, it clears the full CVD target even muted: lightness band, chroma floor, and CVD separation (worst adjacent ΔE 8.1, protan) all pass; both groups hold at least 3:1 against parchment at `mark-opacity-resting`. See `docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md` for how this 2-group split and the current per-category assignment were arrived at.

| Group | Hex | Rhymes with (People domain) | `MilestoneCategory` values |
|---|---|---|---|
| Science & Innovation | `#008255` | Science & Technology | `science-theory`, `medicine-health`, `communication`, `transportation`, `everyday-technology`, `food-agriculture`, `energy-industry` |
| Social & Human Culture | `#946513` | Public Figure | `public-health`, `media-culture`, `landmarks`, `infrastructure`, `expedition`, `society-administration`, `culture-arts`, `religion-mythology`, `environment-geology`, `commerce-finance`, `social-movements`, `sports-entertainment`, `philosophy-education`, `law-jurisprudence`, `archaeology-anthropology` |

## Typography

| Role | Typeface |
|---|---|
| Display | Fraunces (serif, variable) — used sparingly (currently: DetailPanel's entity name and the timeline's Viewport Range heading) |
| Body / UI / Data | Archivo — all UI chrome, entry labels, and data. No separate mono face: year ranges and dates set in Archivo with `font-variant-numeric: tabular-nums` instead, so a date never reads as a costume change from the surrounding text |

## Mark Opacity

| Token | Value | Usage |
|---|---|---|
| `mark-opacity-resting` | `0.8` | Resting opacity of every lane line and dot; hover and selection restore `1`. Labels are unaffected. Every domain, group and Conflict color is set dark enough to hold at least 3:1 against parchment at this opacity. |

## Motion

Honors `prefers-reduced-motion: reduce` — all transitions using these tokens are gated by `@media (prefers-reduced-motion: no-preference)` (near-instant otherwise). See `docs/adr/0006-css-animation-scope-and-detail-panel-always-mounted.md` for what is/isn't animated.

| Token | Value | Usage |
|---|---|---|
| `motion-duration-fast` | `120ms` | Hover feedback (lane marks, language switcher, viewport rect) |
| `motion-duration-base` | `200ms` | DetailPanel open/close slide |
| `motion-easing` | `cubic-bezier(0.4, 0, 0.2, 1)` | All of the above |

## Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-full` | `9999px` | Filter chips |
| `radius-sm` | `6px` | Event point-markers |
| `radius-md` | `8px` | Not currently consumed by `widgets/timeline-canvas` — Period lines (People, Conflicts) use `stroke-linecap: round` for their rounded caps instead of a corner radius |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
