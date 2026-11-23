---
name: O Tempora
description: An interactive timeline of world history set as a parchment ledger — iron-gall ink, one oxblood seal.
colors:
  parchment: "#f2e9d2"
  ledger-paper: "#fbf6e9"
  white-sheet: "#ffffff"
  axis-bar: "#ebddbd"
  hairline: "#e0d3ac"
  rule-strong: "#c7b383"
  control-border: "#837757"
  ink: "#241a10"
  faded-ink: "#6b6046"
  oxblood: "#8a2a1a"
  oxblood-deep: "#6e2013"
  selection-halo: "#241a1024"
  scrim: "#00000066"
  conflict-red: "#8c2d2b"
  domain-sports: "#9a5c73"
  domain-business-law: "#347830"
  domain-humanities: "#4e4993"
  domain-institutions: "#b6514c"
  domain-exploration: "#3e70b0"
  domain-arts: "#a85a3d"
  domain-science-technology: "#357b5c"
  domain-public-figure: "#8e672c"
  milestone-science-innovation: "#008255"
  milestone-social-culture: "#946513"
typography:
  focus-range:
    fontFamily: "Fraunces, serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  panel-heading:
    fontFamily: "Fraunces, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  wordmark:
    fontFamily: "Fraunces, serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Archivo, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Archivo, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Archivo, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  lane-label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
  eyebrow:
    fontFamily: "Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  axis-label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  badge:
    fontFamily: "Archivo, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  space-1: "4px"
  space-1-5: "6px"
  space-2: "8px"
  space-2-5: "10px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
components:
  pill:
    backgroundColor: "{colors.white-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  pill-hover:
    backgroundColor: "{colors.ledger-paper}"
  pill-active:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
  search-input:
    backgroundColor: "{colors.white-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    padding: "6px 10px"
  switch-trigger:
    backgroundColor: "{colors.white-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    padding: "0 12px"
  switch-pip-reached:
    backgroundColor: "{colors.oxblood}"
  button-primary:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.white-sheet}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  icon-button:
    backgroundColor: "{colors.white-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "28px"
  close-button:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "28px"
  card:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  detail-panel:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    width: "440px"
    padding: "20px"
  year-axis:
    backgroundColor: "{colors.axis-bar}"
    textColor: "{colors.faded-ink}"
    typography: "{typography.axis-label}"
---

# Design System: O Tempora

## Overview

“The Scribe’s Chronicle” uses the Ledger & Ink palette of parchment, iron-gall text and oxblood for interactive state. Keep the controls compact and the marks prominent. Labels use short, sentence-case nouns. The site uses a single light theme.

## Colors

Token values and palette order are listed in [Design tokens](docs/design-tokens.md).

### Primary
- **Oxblood Seal** (#8a2a1a): The only accent. Active pill border, reached Detail Level pips, primary button fill, search-match emphasis, the minimap viewport rectangle and the scrubber thumb. 6.4:1 or better as text on parchment and ledger paper.
- **Deep Oxblood** (#6e2013): Keyboard focus ring only (2px outline, 8.3:1 or better on every ground).

### Data encoding

People use the Occupation Domain palette in its fixed order. Milestones use two category-group colors, and Conflicts use a single red. Keep labels in Ink. Round-cap lines encode periods and dots encode points in time. Check new mark colors against the existing palette and retain at least 3:1 contrast against parchment at resting opacity.

### Neutral
- **Parchment** (#f2e9d2): Page and canvas background; also the fill of close buttons.
- **Ledger Paper** (#fbf6e9): Floating cards, panels, tooltips, and the hover state of pills.
- **White Sheet** (#ffffff): Interactive controls only: pills, search input, dropdown, zoom buttons, the Detail Level trigger and its list.
- **Axis Bar** (#ebddbd): Year Axis ruler, painted at 82% so the zebra bands show through.
- **Ink** (#241a10): All primary text and every entry label.
- **Faded Ink** (#6b6046): Dates, captions, placeholders, eyebrows, tick labels (4.6:1 or better).
- **Control Border** (#837757): Borders of every interactive control and the century ticks (3.7:1 on parchment). Hover steps to Faded Ink.
- **Hairline** (#e0d3ac) and **Strong Rule** (#c7b383): Decorative dividers and decade ticks only; below 3:1 by design.
- **Selection Halo** (#241a10 at 14%): Translucent ink fill drawn 8px beyond a selected mark.
- **Scrim** (#000000 at 40%): Behind sheets and the About modal.

Reserve Deep Oxblood outlines for keyboard focus. Offset them by 1–2px, inward for joined controls. Use Control Border for interactive outlines and Faded Ink on hover.

## Typography

**Display Font:** Fraunces 600 (with serif fallback)
**Body Font:** Archivo 400/600/700 (with sans-serif fallback)

Use Archivo for UI, labels and data, with tabular figures for years and dates. Use Fraunces for the headings and wordmark listed below.

### Hierarchy
- **Focus Range** (Fraunces 600, 56px, 1; 32px below 960px): The years of the selection, or the visible window when nothing is selected, as the screen's heading, tabular figures.
- **Panel Heading** (Fraunces 600, 20px, 1.2): Entity name in the detail panel and heading of the About panel.
- **Wordmark** (Fraunces 600, 18px): "O Tempora" beside the 24px seal mark.
- **Landing Headline and Lede** (Fraunces 600): lede (the curiosity sentence) 24–36px at 1.2 leads; headline 26–32px at 1.15 sits above it as the page title, on the landing page only.
- **Landing Pitch** (Archivo 400, 16px, 1.5, Faded Ink): the one-line explanation under the landing headline. Curiosity chips on the landing page are the filter pill at 14px, headed by a 13px Faded Ink prompt; below 640px a prev/next stepper under that prompt replaces them. Landing axis ticks are 12px.
- **Body** (Archivo 400, 14px, 1.5): Descriptions in the detail panel. Keep lines near 55 characters in the 440px panel.
- **Body Small** (Archivo 400, 13px, 1.5): Date lines, buttons and links; taglines in italic.
- **Control** (Archivo 400, 12px, 1.4): Pills, inputs, results, the Detail Level trigger and rows; 600 for an active pill, the selected level and its row.
- **Caption and Lane Label** (Archivo 400, 11px): Image attribution, Detail Level row descriptions, the trigger's "Detail Level" prefix, and entry labels on the timeline.
- **Eyebrow** (Archivo 600, 11px, 0.06em, uppercase in CSS): Section headings in Faded Ink.
- **Axis Label and Badge** (Archivo 400, 10px): Year Axis ticks and the type badge in search results; nothing smaller occurs.

## Layout

A full-viewport canvas read left to right, with the Focus Range as a 72px heading strip above the lanes and the Year Axis as a ruler between them. People sit above the axis and Conflicts and Milestones below it, the most famous rows hugging the axis so importance radiates outward. A 56px Top Bar above it holds search, Detail Level, the Filters button, Help and the language switch. The Filters Panel opens as a popover beneath it. A minimap card sits beneath the lanes on desktop; on phones a 24px scrubber strip sits between the Focus Range and the lanes instead.

Spacing is a short ladder of 4, 6, 8, 10, 12, 16, 20 and 24px. Controls sit 8px from canvas corners, cards are inset 12px, and sections are separated by 24px. At 960px and below the Top Bar wraps to two rows (search, Filters and Help, then the language switch and Detail Level) and drops the wordmark, the Filters Panel and the detail panel become bottom sheets (80vh max) over a scrim, the Focus Range shrinks to 32px, and the minimap gives way to the scrubber. Zoom buttons are hidden on coarse pointers in favour of pinch.

Background texture is a faint 25-year zebra wash with century seams in Control Border at 45%. There are no gradients and no imagery in chrome; entity photos appear only in the detail panel.

## Elevation & Depth

Layer Parchment, Ledger Paper and White Sheet. Use shadows on floating surfaces and tone or hairlines on inline surfaces.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 4px 16px rgba(36, 26, 16, 0.12)`): Minimap card.
- **Tooltip** (`box-shadow: 0 2px 6px rgba(36, 26, 16, 0.15)`): Minimap hover tooltip.
- **Dropdown** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`): Search results.
- **Drawer** (`box-shadow: 8px 0 32px rgba(0, 0, 0, 0.15)`): The detail side panel (x offset flipped for the right edge).
- **Popover** (`box-shadow: 0 8px 24px rgba(36, 26, 16, 0.18)`): Filters Panel on desktop.
- **Modal** (`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25)`): About modal.

Draw an 8px-wider Selection Halo behind selected or search-jumped marks and retain the mark’s lane color.

## Shapes

Round where the hand touches, gentle where it reads. Pills, inputs, close buttons, the Detail Level trigger and swatches are fully round (9999px); small rectangular buttons and the zoom group use 8px; tooltips, result rows and point markers use 6px; cards, the dropdown and the minimap use 12px; the About modal uses 16px. Period marks are lines with round caps, never boxes. A point in time is a dot.

## Components

### Pills (filters)
- **Style:** White Sheet fill, 1px Control Border, fully round, 12px Ink text, 4px/10px padding, a 10px colour swatch dot leading where the pill is a domain.
- **Hover:** Border to Faded Ink, fill to Ledger Paper.
- **Active:** Oxblood border plus an inset 1px oxblood ring, Ledger Paper fill, weight 600. Stays oxblood on hover.
- **Focus:** 2px Deep Oxblood outline, 1px offset.

### Search
- **Style:** Same pill language as filters (White Sheet, Control Border, fully round, 6px/10px padding). Placeholder in Faded Ink.
- **Results:** White Sheet dropdown with Hairline border and 12px radius; rows 6px radius, Ledger Paper on hover or active; a 10px uppercase badge in Faded Ink; matched text in Oxblood at weight 700.

### Detail Level Switch
- **Style:** One pill, 32px tall: a Faded Ink "Detail Level" prefix, the selected level's name in Ink at 600, four 10×4px pips (one per level reached, Oxblood; the rest Hairline) and a `▾` glyph. White Sheet fill, 1px Control Border, hover to Ledger Paper with a Faded Ink border. Open, it takes the active-pill treatment (Oxblood border plus inset ring, Ledger Paper fill) and the glyph flips.
- **List:** Opens beneath the pill as a White Sheet panel (Hairline border, 12px radius, Dropdown shadow), at least 300px wide and right-aligned to the pill. Each row is 44px tall with a 6px radius: level name at 12px, its one-line description at 11px in Faded Ink, and its pips on the right. The selected row is Ledger Paper with an Oxblood inset ring and a 600 name. Picking a row closes the list and returns focus to the pill; Escape or a press outside closes it too.
- **State:** A level whose data is still loading pulses the pill's opacity, gated on motion preference, and is announced to assistive tech.
- **Size:** The pill is 280px in the Top Bar and fills the space beside the language switch on the second row at 960px and below. At 420px and below, pips appear only in the list so the selected level fits in the trigger.

### Buttons
- **Primary:** Oxblood fill, White Sheet text, 13px, 8px radius, 8px/14px padding. Used for the Wikipedia link.
- **Icon and zoom:** 28px square, White Sheet fill, 1px Control Border, 8px radius; zoom buttons form a joined vertical group with dividers and no gap. Glyphs `+` and `−` rather than words.
- **Close:** 28px round, Parchment fill, no border, `×` glyph.
- **Text link:** Underlined Faded Ink at 12px, darkening to Ink on hover.

### Cards and Panels
- **Profile sources:** Key Moments and Deep Facts with a source show an underlined Faded Ink "Source ↗" link below the passage, 12px type, darkening to Ink on hover with a Deep Oxblood focus ring. Links open in a new tab and have 44px touch targets on coarse pointers. Passages without a source omit the link.
- **Corner style:** 12px; panel edges square against the viewport; mobile sheet 8px on its top corners.
- **Background:** Ledger Paper with a 1px Hairline border. Floating cards carry the Card shadow.
- **Detail panel:** 440px right drawer, 260px image slot (200px when a Profile is shown), 20px body padding, name in Fraunces and tagline italic in Faded Ink pinned to the top of the scroll over a Hairline rule that appears once content passes beneath, a 200ms slide. A Profile replaces the Description with its overview, then three sections under Eyebrow headings separated by a Hairline rule: Key Moments as a Hairline thread of lane-coloured marks (a dot for a moment, a round-capped line for a span) with the date, a 600 title and a paragraph whose `**bold**` runs are weight 600; Deep Facts as Parchment wells (12px radius, no border or shadow), a legend carrying a Strong Rule-outlined "Legend" tag; Connections as rows (lane swatch, name, one-sentence reason, `›`) that open the target, a target below the current Detail Level marked with the Detail Level switch's four pips in Faded Ink and "Appears at <level>". The Wikipedia button sits in a sticky footer under a Hairline rule. A Profile Anchor scrolls the matching passage into view and marks it in the panel.

### Timeline Marks and Year Axis (signature)
- **Marks:** Round-cap lines and dots at 0.8 opacity at rest, 1 on hover and selection. Lane labels 11px Ink, the label scaling 1.15 on hover.
- **Year Axis:** An Axis Bar ruler with three tick weights climbing the border ladder (decade in Strong Rule, century in Control Border), century tabs in White Sheet with bold Ink labels, tick labels at 10px tabular figures.

### Navigation
- **Top Bar:** A 56px Ledger Paper strip with a Hairline underline: wordmark, search pill, Detail Level switch, then a Filters pill button and a 32px round `?` Help button, followed by a pill link labeled in the destination language. The Filters button carries an Oxblood count badge while filters are active. 44px tall controls on coarse pointers.
- **Filters Panel:** A 400px Ledger Paper popover (12px radius, Popover shadow) under the Filters button, titled in Fraunces with a `×` close; eyebrow-headed pill lists for Occupation, Conflicts & Milestones and Region, scrolling inside. At 960px and below it is a bottom sheet over a scrim.
- **Help footer:** About appears as an underlined button in the Help panel footer, below a Hairline top rule.

### Motion
Hover feedback runs 120ms and panel slides and fades 200ms on `cubic-bezier(0.4, 0, 0.2, 1)`. Animate transform and opacity only. Under `prefers-reduced-motion: reduce` both durations collapse to near zero through the shared tokens.

## Interface details

Use text glyphs for compact controls (`×`, `+`, `−`, `«`). Keep chrome at 12px or larger apart from the ticks, badges and captions in the type hierarchy. Keep chrome free of gradients, imagery and emoji. Keep copy plain and omit marketing language and exclamation marks.
