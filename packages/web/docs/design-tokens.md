# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

**Design concept ("Ledger & Ink"):** a parchment-and-ink page — aged paper, iron-gall text, one sharp accent (oxblood) standing in for a wax seal — with color distinguishing entries within that warm neutral base. Color encodes **milestone category** (Milestones) or **occupation domain** (People); Conflicts render in one flat color instead (see Conflict Color below) — never person-vs-event, which is carried by lane and label position instead (People's label above its line, Conflicts'/Milestones' below their marker) plus, within the merged Conflicts+Milestones lane, color itself (flat Conflict Color vs. Milestones' multi-color palette). Shape carries Period vs. PointInTime instead, the same across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Filter chips and timeline entries share the same color end-to-end within each lane. `MilestoneCategory` and `OccupationDomain` are separate enums from separate sources (hand-curated, Pantheon) with separate palettes below — see `CONTEXT.md` for why they aren't unified. `ConflictCategory` still exists as curator-assigned data (see `CONTEXT.md`) but no longer drives a color.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F2E9D2` | Page background (parchment) |
| `color-bg-surface` | `#FBF6E9` | Filter bar, sidebar, event point-markers, detail/tooltip panel (ledger) |
| `color-bg-surface-raised` | `#FFFFFF` | Filter chips, filter pills |
| `color-border-subtle` | `#E0D3AC` | Default borders, dividers |
| `color-border-strong` | `#C7B383` | Hover/active borders |
| `color-text-primary` | `#241A10` | Primary text (ink) |
| `color-text-secondary` | `#6B6046` | Secondary/muted text (faded ink) |
| `color-accent-selected` | `#8A2A1A` | Selected entity, viewport indicator, focus ring (oxblood) |
| `color-focus-ring` | `#6E2013` | Keyboard focus outline |

## Conflict Color

Used as the stroke/fill color for every Conflict's range line and point-dot marker, regardless of `ConflictCategory`. Retired the old per-category Conflict Category Palette (six hues keyed by `ConflictCategory`) once Conflicts and Milestones merged into one mixed, fame-ranked lane (`packages/web/src/widgets/timeline-canvas/ConflictsMilestonesLane.tsx`) — a Conflict needs to read as one visual group at a glance next to Milestones' own multi-color palette below, not blend into it category-by-category. Rhymes with the People-domain Institutions hue (state power), stepped darker — see Milestone Category Palette below for the same treatment applied to each Milestone group.

| Token | Hex |
|---|---|
| `color-conflict` | `#8C2D2B` |

## Occupation Domain Palette

People-lane only. Keyed by Pantheon's `OccupationDomain` (a different enum and source than the flat Conflict Color above, or Milestones' own category palette). Used as the stroke color on People-lane lifespan lines and the sidebar legend swatch. Re-derived from Pantheon's source hues, muted into the Ledger & Ink chroma range (most sit at or just above the OKLCH chroma floor — as desaturated as they can go before reading as gray) and ordered so every adjacent pair in the table below clears the CVD-safety checks — this is also the order the sidebar legend should render in; reordering it re-opens the adjacency question. Validated with `dataviz`'s `validate_palette.js` (OKLCH lightness/chroma bounds, CVD separation simulated under protanopia/deuteranopia, a normal-vision floor, contrast vs. the parchment surface): lightness band and chroma floor pass; CVD separation lands in the legal floor band (worst adjacent pair ΔE 6.4, deutan) rather than a clean pass, the trade for pulling every hue this close to gray — legal only because color here is never the only identity channel (label, lane, and line-vs-dot shape carry it too, same principle the Design Concept above states); contrast is a WARN for Public Figure (2.6:1 vs. parchment), mitigated by the always-visible label beside every bar.

| Domain | Token | Hex |
|---|---|---|
| Sports | `color-domain-sports` | `#BA6F8A` |
| Business & Law | `color-domain-business-law` | `#347830` |
| Humanities | `color-domain-humanities` | `#4E4993` |
| Institutions | `color-domain-institutions` | `#BA534E` |
| Exploration | `color-domain-exploration` | `#3E70B0` |
| Arts | `color-domain-arts` | `#BD6545` |
| Science & Technology | `color-domain-science-technology` | `#3F936E` |
| Public Figure | `color-domain-public-figure` | `#BB883A` |

## Milestone Category Palette

Milestones-only, keyed on `MilestoneCategory`. The taxonomy stays all 22 values for filtering, tooltips, and filter-chip labels — only *color* folds it down to 2 legible groups, each one a darker, richer step of the People-domain hue its content actually echoes (same pigment, different register: People reads as the lit, vivid layer; Conflicts/Milestones as the darker ink marking what happened). A prior one-hue-per-category palette sat at well under 10° hue separation — below any CVD-safe spacing, and more colors than a legend can hold anyway. This set, together with the flat Conflict Color above, is small enough (3 colors) to validate *every* pair against every other, not just neighbors — and unlike the Occupation Domain palette above, it clears the full CVD target even muted: lightness band, chroma floor, and CVD separation (worst adjacent ΔE 8.1, protan) all pass; contrast is a WARN only for Social & Human Culture (2.8:1), mitigated the same way as the domain palette above. Replaces a prior 3-group split (Knowledge & Culture / Technology & Industry / Society & Governance, 2026-08-12) with a coarser Science-vs-Social split (2026-08-13) worked out ad hoc against the actual milestone counts per category — `medicine-health` was split into a new `public-health` leaf category so pandemics/public-health-administration items (Black Death, 1918 flu, COVID-19, US FDA, Hygiene, Great Irish Famine) could land in Social while the rest of medicine-health (treatments, vaccines, procedures) stays in Science; a further same-day pass split `media-culture` out of `communication` (Penny Black, BBC Television Service launch, Facebook, Workers Leaving the Lumière Factory, View from the Window at Le Gras), moved `archaeology-anthropology` wholesale to Social, and merged the retired `architecture-design` with `infrastructure` into a new `landmarks` category; a still-further same-day pass renamed `exploration` to `expedition` (keeping its journey/expedition items), moved its craft/technology items (Sextant, Sputnik 1, Vostok 1, Voyager 1, International Space Station) to `everyday-technology`/`transportation`, and moved `infrastructure` in its entirety to Social alongside `landmarks`, dropping the transit-vs-landmark distinction from the prior pass.

| Group | Hex | Rhymes with (People domain) | `MilestoneCategory` values |
|---|---|---|---|
| Science & Innovation | `#008456` | Science & Technology | `science-theory`, `medicine-health`, `communication`, `transportation`, `everyday-technology`, `food-agriculture`, `energy-industry` |
| Social & Human Culture | `#BC8118` | Public Figure | `public-health`, `media-culture`, `landmarks`, `infrastructure`, `expedition`, `society-administration`, `culture-arts`, `religion-mythology`, `environment-geology`, `commerce-finance`, `social-movements`, `sports-entertainment`, `philosophy-education`, `law-jurisprudence`, `archaeology-anthropology` |

## Typography

| Role | Typeface |
|---|---|
| Display | Fraunces (serif, variable) — used sparingly (currently: DetailPanel's entity name) |
| Body / UI / Data | Archivo — all UI chrome, entry labels, and data. No separate mono face: year ranges and dates set in Archivo with `font-variant-numeric: tabular-nums` instead, so a date never reads as a costume change from the surrounding text |

## Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-full` | `9999px` | Filter chips |
| `radius-sm` | `6px` | Event point-markers |
| `radius-md` | `8px` | Not currently consumed by `widgets/timeline-canvas` — Period lines (People, Conflicts) use `stroke-linecap: round` for their rounded caps instead of a corner radius |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
