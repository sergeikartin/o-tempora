---
version: 1
slug: "src-app-landing-landingpage-tsx"
primary_target: "src/app/landing/LandingPage.tsx"
related_targets: ["src/app/landing/LandingPage.module.css"]
---

# Landing page (/ and /ru/)

Mode: Persuade. Cold visitor from a shared link; the action is "Explore the timeline" (opens /timeline/). Proof is real dataset dates only (to the month); no usage claims.

## Direction contract

THESIS: One quiet folio page whose hook is a curious coincidence, not a feature list: a Fraunces sentence states one overlap ("Einstein and Jobs were alive at the same time") and the same overlap is drawn beside it as the product draws it. Nine hand-picked curiosities sit behind a row of pills. Refuses the centred hero over a row of feature cards, and any auto-rotating carousel.

OWN-WORLD: Existing Ledger & Ink: parchment ground, ink text, one oxblood CTA, round-cap ink bars in domain colours, Axis Bar ruler with tabular tick labels, Conflict Red bars, an ink-tint wash for an overlap window, filter-pill chips. Bars that run past the window are cut square at its edge. No cards, no shadows, no gradients.

STORY: The visitor reads one surprising sentence, sees the marks that prove it on one axis, understands the product, and either presses the button or taps another curiosity and gets the same reaction again.

FIRST VIEWPORT: Left column: headline 32px and a 16px pitch as the intro, then the curiosity sentence at 36px Fraunces leading (block sized to the longest sentence so nothing below it moves), CTA (opens the shown overlap's first mark on the timeline), then a labelled row of pill chips. Right column (480-540px, top-aligned with the copy): figure with its marks, axis and caption plus Entity Links. CTA stays above the fold on a 360x640 phone; below 640px, and on short landscape phones, the chips give way to a prev/next stepper directly above the figure, so it stays put across taps and sits in the first screen. The picked curiosity lives in the URL hash.

FORM: Quiet Folio with a case switcher; user-chosen over a scroll of curiosities and an auto-rotating hero (seed:d12fb562934fb476, reroll 3, assigned form kept).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
