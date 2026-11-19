# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

This doc is the source of truth for token values. `packages/web/DESIGN.md` mirrors them in its frontmatter for design tooling; change a value here first, then there.

Visual style guide (Artifact, mirrors this doc): https://claude.ai/code/artifact/a7a65576-55d0-4602-b113-7b178bdb0a57

Marks and filter swatches share a palette per lane. Color identifies People’s Occupation Domain and the Milestones group. Conflicts share one color. Labels stay Ink, above People periods, below Conflict and Milestone periods, and to the right of points. [Component rules](../DESIGN.md)

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F2E9D2` | Page background (parchment) |
| `color-bg-surface` | `#FBF6E9` | Top Bar, Filters Panel, cards, detail panel, search results (ledger) |
| `color-bg-surface-raised` | `#FFFFFF` | Filter chips, filter pills |
| `color-border-subtle` | `#E0D3AC` | Default borders, dividers |
| `color-border-strong` | `#C7B383` | Hover/active borders |
| `color-border-control` | `#837757` | Borders of interactive controls (filter pills, search input, Detail Level trigger, zoom, Filters and Help buttons) — 3.7:1 on `color-bg-base`, 4.4:1 on `color-bg-surface-raised`; hover steps to `color-text-secondary` |
| `color-border-emphasis` | `#837757` | Year Axis's century tick mark (darkest of its three tick layers) |
| `color-text-primary` | `#241A10` | Primary text (ink) |
| `color-text-secondary` | `#6B6046` | Secondary/muted text (faded ink) |
| `color-accent-selected` | `#8A2A1A` | Viewport indicator, focus ring (oxblood) |
| `color-selection-halo` | `#241A10` at 14% | Selected or search-jumped mark halo, extending 8px beyond the mark |
| `color-focus-ring` | `#6E2013` | Keyboard focus outline |
| `color-bg-axis` | `#EBDDBD` | Year Axis ruler background |

## Conflict Color

All Conflict lines and dots use Conflict Red, a darker step of the Politics & Religion hue. D3 uses `CONFLICT_COLOR` and the Minimap reads `--color-conflict` from `global.css`.

| Token | Hex |
|---|---|
| `color-conflict` | `#8C2D2B` |

## Occupation Domain Palette

Use this order for People marks and Occupation filters. Adjacent pairs are checked under simulated protanopia and deuteranopia, so rerun those checks if the order changes. Each hue clears 3:1 against parchment at resting opacity.

| Domain | Token | Hex |
|---|---|---|
| Sports | `color-domain-sports` | `#9A5C73` |
| Business & Law | `color-domain-business-law` | `#347830` |
| Humanities | `color-domain-humanities` | `#4E4993` |
| Politics & Religion | `color-domain-institutions` | `#B6514C` |
| Exploration | `color-domain-exploration` | `#3E70B0` |
| Arts | `color-domain-arts` | `#A85A3D` |
| Science & Technology | `color-domain-science-technology` | `#357B5C` |
| Public Figures | `color-domain-public-figure` | `#8E672C` |

## Milestone Category Palette

Two groups supply colors for the 22 Milestone categories. Both clear 3:1 against parchment at resting opacity. The two group colors plus Conflict Red meet the lightness, chroma and color-vision separation targets (minimum simulated ΔE 8.1 under protanopia). [Category grouping](../../../docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md)

| Group | Hex | Rhymes with (People domain) | `MilestoneCategory` values |
|---|---|---|---|
| Science & Innovation | `#008255` | Science & Technology | `science-theory`, `medicine-health`, `communication`, `transportation`, `everyday-technology`, `food-agriculture`, `energy-industry` |
| Society & Culture | `#946513` | Public Figures | `public-health`, `media-culture`, `landmarks`, `infrastructure`, `expedition`, `society-administration`, `culture-arts`, `religion-mythology`, `environment-geology`, `commerce-finance`, `social-movements`, `sports-entertainment`, `philosophy-education`, `law-jurisprudence`, `archaeology-anthropology` |

## Typography

| Role | Typeface |
|---|---|
| Display | Fraunces, variable serif |
| Body / UI / Data | Archivo, with tabular numerals for years and dates |

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
| `radius-sm` | `6px` | Search result rows, tooltips |
| `radius-md` | `8px` | Not currently consumed by `widgets/timeline-canvas` — Period lines (People, Conflicts) use `stroke-linecap: round` for their rounded caps instead of a corner radius |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
