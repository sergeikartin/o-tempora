# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

**Design concept:** warm, paper-like page with pastel colors distinguishing entries (set by reference image `greece-view.png`). Color encodes **conflict category** (Wars & Conflicts), **discovery category** (Events & Inventions), or **occupation domain** (People) — never person-vs-event, which is carried by lane and label position instead (People's label above its line, Wars & Conflicts'/Events & Inventions' below their marker). Shape carries Period vs. PointInTime instead, the same across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Filter chips and timeline entries share the same color end-to-end within each lane. `ConflictCategory`, `DiscoveryCategory`, and `OccupationDomain` are separate enums from separate sources (Wikidata SPARQL, hand-curated, Pantheon) with separate palettes below — see `CONTEXT.md` for why they aren't unified.

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

## Conflict Category Palette

Used as the stroke color for Wars & Conflicts' range lines and point-dot markers. Keyed by `ConflictCategory` (`packages/shared-types`) — a curator-assigned taxonomy (see `CONTEXT.md`), disjoint from `DiscoveryCategory` even where a name might coincide. Hue-optimized against the Occupation Domain Palette and Events & Inventions' own `DiscoveryCategory` palette (24 colors total sharing one hue circle) per `.scratch/wars-conflicts-taxonomy/issues/02-rename-expand-conflict-category.md`'s Answer — war-family categories (war/military-operation) grouped into warm hues, the rest into cooler ones. `battle`/`siege`/`peace-treaty` were dropped from the six-value taxonomy (`.scratch/wars-curated-source/spec.md`) as inherently sub-events of a war rather than standalone conflicts; their palette entries dropped with them, not left unused.

| Category | Token | Hex |
|---|---|---|
| War | `color-conflict-war` | `#BF696B` |
| Military operation | `color-conflict-military-operation` | `#BDC251` |
| Revolution | `color-conflict-revolution` | `#7DBE74` |
| Rebellion | `color-conflict-rebellion` | `#6BBDB3` |
| Coup d'état | `color-conflict-coup-d-etat` | `#7BA8C1` |
| War of independence | `color-conflict-war-of-independence` | `#8E8DC4` |

No category tag / uncategorized → `color-border-subtle` as a neutral fallback, not a tenth pastel.

## Occupation Domain Palette

People-lane only. Keyed by Pantheon's `OccupationDomain` (not `ConflictCategory` above — different enum, different source). Used as the stroke color on People-lane lifespan lines. Values are lifted verbatim from pantheon.world's own CSS custom properties (`--colorInstitutions` etc.) rather than derived, so the legend matches Pantheon's source exactly.

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
| `radius-md` | `8px` | Not currently consumed by `widgets/timeline-canvas` — Period lines (People, Wars & Conflicts) use `stroke-linecap: round` for their rounded caps instead of a corner radius |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
