---
target: the landing page
total_score: 21
max_score: 28
na_heuristics: 7,9,10
p0_count: 0
p1_count: 2
target_identity: "file:/home/sergei/projects/o-tempora/packages/web/src/app/landing/LandingPage.tsx"
target_fingerprint: "sha256:72ed74c9b44ba64876ec778f883b15248ef6ea22aed8357c4735af46e6266f45"
target_path: /home/sergei/projects/o-tempora/packages/web/src/app/landing/LandingPage.tsx
timestamp: 2026-10-23T12-54-21Z
slug: src-app-landing-landingpage-tsx
---
Method: dual-agent (A: design review, B: detector and browser evidence)

## Design Health Score: 21/28 (75%, Good). Heuristics 7, 9, 10 n/a (Persuade surface)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Selected and keyboard-focused chip look almost identical |
| 2 | Match System / Real World | 3 | "1564", "The Kaiser" cryptic as chip labels |
| 3 | User Control and Freedom | 3 | Chosen case not in URL; reload/Back lose it |
| 4 | Consistency and Standards | 3 | One job split across chips and stepper by breakpoint |
| 5 | Error Prevention | 3 | Mobile "next" button drifts under thumb |
| 6 | Recognition Rather Than Recall | 3 | 8 of 9 cases hidden below 640px; chip legend sr-only |
| 7 | Flexibility and Efficiency | n/a | Persuade surface with one action |
| 8 | Aesthetic and Minimalist Design | 3 | Dead gaps, 10px axis ticks |
| 9 | Error Recovery | n/a | No input or error states |
| 10 | Help and Documentation | n/a | Help lives in the timeline |

## Design Specificity Verdict
About 70% authored. The figure (mirrored axis, square clipping, overlap band, entity links) and the curiosity sentence are ownable. The frame (H1, grey subline, red button, pills, visual on the right) is a generic split hero, and the most authored element is the quietest.

Deterministic scan: `src/app/landing` gave 6-7 findings, all in LandingPage.module.css (overused-font on Fraunces, deliberate; design-system-font-size advisories at lines 55, 65, 82, 463). Live pages: cream-palette (deliberate) and content-hidden-at-rest (false positive; stacked ledes use visibility:hidden by design). No overflow at 360/390/768/1440, no console errors, CTA above fold at 360x640, small text 5.13:1. No overlay (no mutable browser tool).

## Overall Impression
Strong idea, best element is the figure, but the page undersells it: a generic 60px tagline outranks the 30px hook sentence, the figure is small, and the CTA drops the visitor on an unrelated default view.

## What's Working
1. The figure is drawn the way the product draws it.
2. Honest copy and a stable layout (lede stack reserves one grid cell).
3. Solid basics: CTA 8:1, 44px coarse targets, reduced motion, keyboard operable.

## Priority Issues
1. [P1] Mobile stepper drifts under the thumb (Y 588 to 638 to 634 to 584 to 534 across taps; scrollIntoView shifts 54-80px). Fix: reserve chart height for the tallest case; scroll only when off-screen. Commands: layout, harden.
2. [P1] The hook is outranked and the CTA ignores it (60px H1 over 30px sentence; pitch repeats first lede; CTA opens default 1740-1860 view; per-case link 13-14px muted). Fix: sentence dominant, retarget CTA or promote deep link, stronger first case. Commands: clarify, layout.
3. [P2] Figure undersized and fold has dead space (420px column, 6px bars, 10px ticks; 70-95px gap at 360x640; stepper at/below fold; landscape phones push CTA to the edge). Fix: widen to 520-560px, 8-10px bars, 12px ticks, two-column on short wide viewports. Commands: layout, typeset.
4. [P2] Pills read as filters and focus looks like selected (sr-only legend; cryptic labels; 9 tab stops). Fix: visible prompt, distinct focus ring, roving tabindex. Commands: clarify, polish.
5. [P2] Chosen case not shareable or recoverable (useState only). Fix: mirror case id to hash/query with replaceState. Command: harden.

## Persona Red Flags
Jordan: pill row doesn't read as a switcher; no legend for band/colours; 14-month window with one "1955" tick; CTA lands on unrelated view.
Riley: rapid clicks restart 700ms animations; reload/Back lose state; focused and selected chips look the same.
Casey: stepper drifts and page auto-scrolls; stepper cut off (EN) or below fold (RU) at 360x640; landscape CTA at the bottom edge; no preview of other 8 cases.

## Minor Observations
- Fraunces has no Cyrillic: RU headline/ledes fall back to a system serif; 60px RU H1 wraps to two lines.
- RU pitch repeats "до".
- 10px ticks about 4.6:1; secondary text on overlap band about 3.9:1.
- At 390px the Einstein label overlaps the grey band.
- RU chips wrap raggedly (3/4/2 at 1440, 4/4/1 at 768).
- Figure change is silent to screen readers (only the sentence is aria-live).

## Questions to Consider
- If the curiosity sentence is the thesis, why is a tagline twice its size above it?
- What if "Explore" opened the exact overlap the visitor just found?
- Should the page open on the case with the sharpest "wait, really?" rather than the most famous names?
