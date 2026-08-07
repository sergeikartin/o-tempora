# 01 — Prototype: DiscoveryCategory color palette

Type: prototype
Status: resolved

## Question

Pick 10 distinct colors for the new `DiscoveryCategory` taxonomy (`science-theory`, `medicine-health`, `communication`, `transportation`, `infrastructure`, `everyday-technology`, `food-agriculture`, `exploration`, `energy-industry`, `society-administration`), to replace the single `"invention"` entry in `CATEGORY_COLORS` (`packages/web/src/widgets/timeline-canvas/options.ts:108-117`).

Build via `/prototype`: render swatches (or live markers on `EventsLane`) for a candidate palette, distinct enough from the existing People `DOMAIN_COLORS` (8 colors) and Wars & Conflicts' `CATEGORY_COLORS` (7 colors after `"invention"` is removed) that a user scanning the timeline can tell lanes apart, and distinct enough within the 10 to tell categories apart. Consider colorblind-safe separation given 25 total colors will exist across all three lanes' palettes.

React with the user to lock the final 10 hex values.

## Answer

Generated candidates via greedy farthest-point hue sampling against the 15 existing People/Wars hues already on screen (min ~11° hue separation from everything, ~14-37° within the new 10), matched to the app's pastel family (S 30-50%, L 54-68%, per design-tokens.md). Presented two variants (balanced-pastel vs. a bolder/more-saturated version); user picked balanced-pastel. Locked values:

| DiscoveryCategory | Hex | HSL |
|---|---|---|
| `energy-industry` | `#C9BF5E` | H54 S50 L58 (gold) |
| `food-agriculture` | `#B1C987` | H82 S38 L66 (yellow-green) |
| `infrastructure` | `#83B95B` | H94 S40 L54 (green) |
| `medicine-health` | `#72B67E` | H131 S32 L58 (mint-green) |
| `science-theory` | `#70BCC2` | H184 S40 L60 (cyan) |
| `communication` | `#8099C6` | H219 S38 L64 (blue) |
| `transportation` | `#8D82C4` | H250 S36 L64 (blue-violet) |
| `society-administration` | `#9D6DB0` | H283 S30 L56 (violet) |
| `everyday-technology` | `#C893C8` | H300 S32 L68 (orchid) |
| `exploration` | `#C072AB` | H316 S38 L60 (magenta-pink) |
