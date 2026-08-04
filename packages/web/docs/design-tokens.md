# packages/web — Design Tokens

<!-- UI/visual design tokens. Read before touching styling. -->

**Design concept:** warm, paper-like page with pastel colors distinguishing entries (set by reference image `greece-view.png`). Color encodes **occupation category**, not person-vs-event — person vs. event is carried by lane and shape instead. Filter chips and timeline entries share the same category color end-to-end.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F3EEDD` | Page background |
| `color-bg-surface` | `#FBF8F0` | Filter bar, sidebar, event point-markers |
| `color-bg-surface-raised` | `#FFFFFF` | Detail/tooltip panel |
| `color-border-subtle` | `#DED3B8` | Default borders, dividers |
| `color-border-strong` | `#C9B98F` | Hover/active borders |
| `color-text-primary` | `#2E2B22` | Primary text |
| `color-text-secondary` | `#83795F` | Secondary/muted text |
| `color-text-on-category` | `#FBF8F0` | Text on a solid category-colored bar |
| `color-accent-selected` | `#B8842E` | Selected entity, viewport indicator, focus ring |
| `color-focus-ring` | `#8C5A1E` | Keyboard focus outline |

## Occupation Category Palette

Used as a solid fill (People-lane bars) or a colored border on white/cream (Events-lane markers).

| Category | Token | Hex |
|---|---|---|
| Science | `color-category-science` | `#7FA6C4` |
| Politics | `color-category-politics` | `#D8A34D` |
| Art | `color-category-art` | `#C98A9A` |
| Philosophy | `color-category-philosophy` | `#8CAE8A` |
| War | `color-category-war` | `#B06156` |
| Invention | `color-category-invention` | `#6FA8A0` |
| Exploration | `color-category-exploration` | `#D08A54` |
| Religion | `color-category-religion` | `#A891C4` |

No occupation tag / uncategorized → `color-border-subtle` as a neutral fallback, not a ninth pastel.

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
| `radius-md` | `8px` | People-lane range bars |
| `radius-lg` | `12px` | Panels |
| `radius-xl` | `16px` | Reserved for future modal/overlay |
