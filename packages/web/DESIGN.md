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

<!-- impeccable:design-map -->
Name: O Tempora
Colors: primary: oxblood #8a2a1a; secondary: conflict-red #8c2d2b; neutral: parchment #f2e9d2; primary: oxblood-deep #6e2013; secondary: domain-sports #9a5c73; secondary: domain-business-law #347830 (+16 more in the sidecar)
Fonts: Fraunces (focus-range, panel-heading, wordmark); Archivo (body, body-sm, control, caption, lane-label, eyebrow, axis-label, badge)
Spacing: space-1 4px, space-1-5 6px, space-2 8px, space-2-5 10px, space-3 12px, space-4 16px, space-5 20px, space-6 24px
Radius: sm 6px, md 8px, lg 12px, xl 16px, full 9999px
Elevation:
- Card: 0 4px 16px rgba(36, 26, 16, 0.12)
- Tooltip: 0 2px 6px rgba(36, 26, 16, 0.15)
- Dropdown: 0 4px 12px rgba(0, 0, 0, 0.15)
- Drawer: 8px 0 32px rgba(0, 0, 0, 0.15)
- Popover: 0 8px 24px rgba(36, 26, 16, 0.18)
- Modal: 0 8px 32px rgba(0, 0, 0, 0.25)
Map: docs/design-tokens.md
Full: .impeccable/design-full.md (read a section when you need its detail)
