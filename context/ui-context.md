# UI Context: World History Timeline

## Design Concept

Direction set explicitly by reference image (`greece-view.png`): a warm, paper-like page with an array of pastel colors distinguishing entries. This supersedes the earlier dark/archival direction — grounded now in an explicit visual reference rather than an assumption, so it's followed exactly rather than treated as a generic default to avoid.

**A real design decision this forces, flagged rather than silently resolved:** in the reference image, bar color encodes *what the entry is* (a kingdom, a campaign, a war) — there's no equivalent to our People-vs-Events split. Reusing that idea directly, our pastel array is mapped to **occupation category** (science, politics, art, philosophy, war, invention, exploration, religion) instead — the same category tag both people and events already carry in the data model. This means:

- **Color now means "field of activity,"** not "person vs. event." A politician and a political event are the same amber; a scientist and a scientific discovery are the same blue.
- **Person vs. event is still unambiguous** — it's carried structurally by lane placement and shape (a range bar in the People lane vs. a point marker in the Events lane), not by color. Nothing is lost; it just isn't color's job anymore.
- This also gives the occupation filter chips a direct visual payoff: toggling "science" highlights exactly the blue entries on the timeline, since the chip and the bars it filters share a color.

**Signature element:** filter chips and timeline entries share the same category color, end to end — clicking "philosophy" doesn't just filter the timeline, it visually confirms which pastel you're now looking for.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#F3EEDD` | Page background — warm parchment/cream |
| `color-bg-surface` | `#FBF8F0` | Filter bar, sidebar, event point-markers — a lighter, near-white paper tone |
| `color-bg-surface-raised` | `#FFFFFF` | Detail/tooltip panel — the most "lifted" surface on the page |
| `color-border-subtle` | `#DED3B8` | Default borders, dividers, unselected chip outlines |
| `color-border-strong` | `#C9B98F` | Hover borders, active chip outlines |
| `color-text-primary` | `#2E2B22` | Primary text — warm dark ink, not pure black |
| `color-text-secondary` | `#83795F` | Secondary/muted text — axis labels, timestamps, helper copy |
| `color-text-on-category` | `#FBF8F0` | Text placed on top of a solid category-colored bar (People lane) |
| `color-accent-selected` | `#B8842E` | Selected entity outline, current-viewport indicator, focus ring — deliberately outside the category palette so "selected" is never confused with a category |
| `color-focus-ring` | `#8C5A1E` | Keyboard focus outline — darker/higher-contrast than `color-accent-selected` against the cream background |

## Occupation Category Palette

Used two ways: as a **solid fill** for People-lane range bars (with `color-text-on-category` text on top), and as a **colored border on a white/cream fill** for Events-lane point markers — mirroring the reference image's treatment of its own duration bars vs. small annotation chips.

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

If a future entry has no occupation tag or an uncategorized one, use `color-border-subtle` as a neutral fallback fill — don't invent a ninth pastel for "unknown."

## Typography

| Role | Typeface | Notes |
|---|---|---|
| Display | **Fraunces** (serif, variable) | App title only — a small, deliberate flavor accent. The reference image itself is clean and utilitarian throughout with no serif display, so this is my own addition, not something the reference required; drop it if you'd rather match the reference's plainer, all-sans look exactly |
| Body / UI | **Inter** | All UI chrome and timeline entry labels — matches the reference image's clean, information-dense sans-serif treatment throughout |
| Data / Dates | **IBM Plex Mono** | Birth–death year ranges and event dates. Tabular figures keep numerals aligned; not something the reference specifically shows, but a reasonable independent choice for a data-dense timeline |

## Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `radius-full` | `9999px` | Filter chips (fame tier, occupation, region) — fully pill-shaped |
| `radius-sm` | `6px` | Event point-markers — matches the reference image's modestly-rounded annotation boxes, not a full pill |
| `radius-md` | `8px` | People-lane range bars |
| `radius-lg` | `12px` | Panels: filter bar, detail/tooltip panel |
| `radius-xl` | `16px` | Reserved for any future modal or full-screen overlay |