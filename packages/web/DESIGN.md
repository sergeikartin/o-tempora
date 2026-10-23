---
name: O Tempora
description: A read-only timeline of world history set as a parchment ledger — iron-gall ink, one oxblood seal.
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
  viewport-range:
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
  switch-dot:
    backgroundColor: "{colors.white-sheet}"
    rounded: "{rounded.full}"
    size: "14px"
  switch-dot-reached:
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
    width: "340px"
    padding: "20px"
  year-axis:
    backgroundColor: "{colors.axis-bar}"
    textColor: "{colors.faded-ink}"
    typography: "{typography.axis-label}"
---

# Design System: O Tempora

## Overview

**Creative North Star: "The Scribe's Chronicle"**

O Tempora reads as a chronicle kept by one careful hand: aged parchment for the page, iron-gall ink for every word, and a single oxblood accent standing in for a wax seal. The data is the ornament. Colour, line and dot do the encoding, so chrome stays small, warm and quiet, and nothing competes with the marks on the timeline.

The system is dense but unhurried. Controls are small, pill-shaped and exact; labels are short sentence-case nouns; years are set in tabular figures in the same face as the text around them. Fraunces appears only where a chronicle would letter a heading: the Viewport Range, an entity's name, the wordmark. There is one theme, light, and the system does not ask for a second.

**Key Characteristics:**
- Warm parchment ground with ink text. No pure black, no pure-white page.
- One sharp accent (oxblood) reserved for state: selected, reached, primary action.
- Colour encodes category within a lane; shape encodes duration (rounded-cap line for a period, dot for a moment), identically in all three lanes.
- Tonal layering for depth. Shadows only on cards that float over the canvas.
- Quiet and exact controls: hairline borders, 12px type, 28px targets.

## Colors

A warm neutral ladder from parchment to white, one oxblood accent, and a muted, colour-blind-checked palette that exists only to encode data.

### Primary
- **Oxblood Seal** (#8a2a1a): The only accent. Active pill border, reached switch dots and track, primary button fill, search-match emphasis, the minimap viewport rectangle. 6.4:1 or better as text on parchment and ledger paper.
- **Deep Oxblood** (#6e2013): Keyboard focus ring only (2px outline, 8.3:1 or better on every ground).

### Secondary (data encoding)
- **Conflict Red** (#8c2d2b): Every Conflict mark and minimap area, flat, regardless of category.
- **People domains**, in fixed legend order: Rosewood (#9a5c73, sports), Fern (#347830, business & law), Indigo Ink (#4e4993, humanities), Brick (#b6514c, institutions), Slate Blue (#3e70b0, exploration), Terracotta (#a85a3d, arts), Verdigris (#357b5c, science & technology), Ochre (#8e672c, public figure).
- **Milestone groups**: Deep Verdigris (#008255, science & innovation) and Dark Ochre (#946513, social & culture), each a darker step of the People hue it echoes.

### Neutral
- **Parchment** (#f2e9d2): Page and canvas background; also the fill of close buttons.
- **Ledger Paper** (#fbf6e9): Floating cards, panels, tooltips, and the hover state of pills.
- **White Sheet** (#ffffff): Interactive controls only: pills, search input, dropdown, zoom buttons, switch dots.
- **Axis Bar** (#ebddbd): Year Axis ruler, painted at 82% so the zebra bands show through.
- **Ink** (#241a10): All primary text and every entry label.
- **Faded Ink** (#6b6046): Dates, captions, placeholders, eyebrows, tick labels (4.6:1 or better).
- **Control Border** (#837757): Borders of every interactive control and the century ticks (3.7:1 on parchment). Hover steps to Faded Ink.
- **Hairline** (#e0d3ac) and **Strong Rule** (#c7b383): Decorative dividers and decade ticks only; below 3:1 by design.
- **Selection Halo** (#241a10 at 14%): Translucent ink fill drawn 8px beyond a selected mark.
- **Scrim** (#000000 at 40%): Behind drawers, sheets and the About modal.

### Named Rules
**The One Seal Rule.** Oxblood marks state and nothing else. It is never decoration and never a lane colour.

**The Ink Label Rule.** Entry labels are always Ink, never the mark's colour; the bar or dot alone carries the category.

**The Fixed Legend Rule.** The eight People domains render in the order listed above. Reordering re-opens the colour-blind adjacency checks.

**The Border Ladder Rule.** An interactive control's border is Control Border. Hairline and Strong Rule never border a control.

## Typography

**Display Font:** Fraunces 600 (with serif fallback)
**Body Font:** Archivo 400/600/700 (with sans-serif fallback)

**Character:** Archivo does all the work of an index: labels, dates, data. Fraunces appears three times only, to letter the headings a scribe would letter.

### Hierarchy
- **Viewport Range** (Fraunces 600, 56px, 1; 32px below 960px): The window of years as the screen's heading, tabular figures.
- **Panel Heading** (Fraunces 600, 20px, 1.2): Entity name in the detail panel and heading of the About panel.
- **Wordmark** (Fraunces 600, 18px): "O Tempora" beside the 24px seal mark.
- **Body** (Archivo 400, 14px, 1.5): Descriptions in the detail panel. Keep lines near 40 characters in the 340px panel.
- **Body Small** (Archivo 400, 13px, 1.5): Date lines, buttons and links; taglines in italic.
- **Control** (Archivo 400, 12px, 1.4): Pills, inputs, results, switch labels; 600 for an active pill, 700 for a reached switch label.
- **Caption and Lane Label** (Archivo 400, 11px): Image attribution, switch descriptions, and entry labels on the timeline.
- **Eyebrow** (Archivo 600, 11px, 0.06em, uppercase in CSS): Section headings in Faded Ink.
- **Axis Label and Badge** (Archivo 400, 10px): Year Axis ticks and the type badge in search results; nothing smaller occurs.

### Named Rules
**The Same Face Rule.** Years and dates use Archivo with tabular figures, never a separate monospace.

**The Three Headings Rule.** Fraunces is for the Viewport Range, the entity name and the wordmark. Chrome stays in Archivo.

## Layout

A full-viewport canvas read left to right, with the Viewport Range as a 72px heading strip above the lanes and the Year Axis as a ruler between them. People sit above the axis and Conflicts and Milestones below it, the most famous rows hugging the axis so importance radiates outward. A floating 320px sidebar (inset 12px) holds search, Detail Level and the filters; a minimap card sits beneath the lanes on desktop.

Spacing is a short ladder of 4, 6, 8, 10, 12, 16, 20 and 24px. Controls sit 8px from canvas corners, cards are inset 12px, and sections are separated by 24px. At 960px and below the sidebar becomes a left drawer over a scrim (280px max, 85vw), the detail panel becomes a bottom sheet (80vh max), the Viewport Range shrinks to 32px, and the minimap is omitted. Zoom buttons are hidden on coarse pointers in favour of pinch.

Background texture is a faint 25-year zebra wash with century seams in Control Border at 45%. There are no gradients and no imagery in chrome; entity photos appear only in the detail panel.

## Elevation & Depth

Depth is tonal first: Parchment, then Ledger Paper, then White Sheet for anything the hand touches. Shadows are reserved for surfaces that float over the canvas and are always ink-tinted rather than black, with a Hairline border alongside. Marks are flat; selection is a halo, not a shadow.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 4px 16px rgba(36, 26, 16, 0.12)`): Floating sidebar and minimap card.
- **Tooltip** (`box-shadow: 0 2px 6px rgba(36, 26, 16, 0.15)`): Minimap hover tooltip.
- **Dropdown** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`): Search results.
- **Drawer** (`box-shadow: 8px 0 32px rgba(0, 0, 0, 0.15)`): Mobile drawer and the detail side panel (x offset flipped for the right edge).
- **Modal** (`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25)`): About modal.

### Named Rules
**The Floaters-Only Rule.** A surface gets a shadow only if it sits over the canvas. Everything inline is separated by tone and hairlines.

**The Halo Rule.** A selected or search-jumped mark gets a duplicate shape in Selection Halo, 8px wider than the grown mark, drawn behind it. The mark itself is never recoloured.

## Shapes

Round where the hand touches, gentle where it reads. Pills, inputs, close buttons, switch dots and swatches are fully round (9999px); small rectangular buttons and the zoom group use 8px; tooltips, result rows and point markers use 6px; cards, the dropdown and the minimap use 12px; the About modal uses 16px. Period marks are lines with round caps, never boxes. A point in time is a dot.

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
- **Style:** A four-stop segmented track. A 4px line fills from the left in Oxblood up to the selected dot over a Hairline track; each stop is a 14px round dot with a 2px Control Border.
- **State:** Reached dots fill Oxblood; the selected dot lifts a map-pin overlay (scale in over 200ms). Reached labels turn Oxblood at weight 700. A loading level pulses its pin, gated on motion preference.
- **Helper:** One line of 11px Faded Ink under the control describes the level.

### Buttons
- **Primary:** Oxblood fill, White Sheet text, 13px, 8px radius, 8px/14px padding. Used for the Wikipedia link.
- **Icon and zoom:** 28px square, White Sheet fill, 1px Control Border, 8px radius; zoom buttons form a joined vertical group with dividers and no gap. Glyphs `+`, `−`, `☰`, `«` rather than words.
- **Close:** 28px round, Parchment fill, no border, `×` glyph.
- **Text link:** Underlined Faded Ink at 12px, darkening to Ink on hover.

### Cards and Panels
- **Corner style:** 12px; panel edges square against the viewport; mobile sheet 8px on its top corners.
- **Background:** Ledger Paper with a 1px Hairline border. Floating cards carry the Card shadow.
- **Detail panel:** 340px right drawer, 260px image slot, 20px body padding, name in Fraunces, tagline italic in Faded Ink, a 200ms slide.

### Timeline Marks and Year Axis (signature)
- **Marks:** Round-cap lines and dots at 0.8 opacity at rest, 1 on hover and selection. Lane labels 11px Ink, the label scaling 1.15 on hover.
- **Year Axis:** An Axis Bar ruler with three tick weights climbing the border ladder (decade in Strong Rule, century in Control Border), century tabs in White Sheet with bold Ink labels, tick labels at 10px tabular figures.

### Navigation
- **Sidebar:** Wordmark and a `«` collapse handle in a header with a Hairline underline; sections of eyebrow-headed pill lists; a footer row of text links above a Hairline top rule. On mobile it is a drawer with a titled header and a `×` close.

### Motion
Hover feedback runs 120ms and panel slides and fades 200ms on `cubic-bezier(0.4, 0, 0.2, 1)`. Animate transform and opacity only. Under `prefers-reduced-motion: reduce` both durations collapse to near zero through the shared tokens.

## Do's and Don'ts

### Do:
- **Do** use Ink for text and every entry label, and Faded Ink for secondary text; both pass 4.5:1 on every surface they sit on.
- **Do** border interactive controls with Control Border (#837757) and step hover to Faded Ink.
- **Do** give every interactive control a 2px Deep Oxblood focus outline with a 1–2px offset (negative inside joined groups).
- **Do** keep chrome type at 12px or larger where it is not data; 10–11px is for ticks, badges and lane labels only.
- **Do** use tabular figures for every year and date.
- **Do** keep marks at least 3:1 against parchment at resting opacity; check any new mark colour against the existing set, not just its neighbour.
- **Do** use text glyphs (`×`, `+`, `−`, `«`) for tight controls.

### Don't:
- **Don't** use oxblood as a lane colour, a decoration, or a hover tint.
- **Don't** recolour a selected mark; add the halo.
- **Don't** colour entry labels with their mark's colour.
- **Don't** add a dark theme or a second accent.
- **Don't** use gradients, imagery or emoji in chrome, or exclamation marks and marketing voice in copy.
- **Don't** add a shadow to an inline surface or a border to a control in Hairline or Strong Rule.
- **Don't** introduce an icon set or a monospace face.
- **Don't** reorder the People domain legend.
