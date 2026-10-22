# Live-site audit — otempora.info (2026-10-22)

Method: headless Chromium (Playwright) against production at 1440×900, 768×1024 and 390×844 (touch), EN and `/ru/`; axe-core 4.10.2; PerformanceObserver for LCP/CLS; manual screenshot review. Screenshots were kept in the session scratchpad, not committed.

**Not covered:** the phone/tablet filter drawer (probe failed), the zoom controls in motion, zero-result filter states, Detail Levels beyond `Mainstream`, real-device testing, cold-cache/throttled-network performance.

## What already works (keep)

- Lab LCP 0.7–1.2 s, CLS 0 on all six combinations; no failed requests. The prerender work (ADR 0013) shows.
- Cohesive "Ledger & Ink" identity: parchment, Fraunces display numerals for the date range, restrained palette. Reads designed, not templated.
- Search, detail panel with image + Wikipedia link, About panel with proper attribution, EN/RU parity, no horizontal overflow at any width.
- The Open Graph card (`og-image.png`) is strong: "Every life in context" plus a legible sample of overlapping bars and the line *"An interactive timeline of overlapping lives, events, and inventions throughout history."* It explains the product better than the site does (finding 1).

## Findings, ranked by "pet project" signal

### High

1. **Zero explanation on arrival.** The only visible `h1` is screen-reader-only; sighted visitors see a date range (`1740 – 1873`) and bars. Nothing says what the bars are, that the horizontal axis is time, that vertical stacking is fame, or that you can drag/zoom. The share card promises an explanation the page never delivers. (Landing-page ticket territory.)
2. **Phone first screen is a bare canvas.** At 390 px: an unlabelled hamburger icon, a date heading, bars cut off at the left edge, no lane labels, no zoom buttons (pinch only, undiscoverable), no minimap. The bottom third is empty (the conflicts/milestones lane is sparse), which reads as broken rather than intentional. The phone is likely the majority of shared-link traffic.
3. **Sidebar covers the timeline on desktop.** The floating Filters card sits over the canvas; marks and labels run underneath it and are clipped mid-word (`orge III of Great Britain`, `n`), and the axis starts under the card (`40` instead of `1740`). Clipped text under a panel is a classic unfinished-UI tell.
4. **Blank image slot in the detail panel.** Selecting an entity opens the panel with a ~260 px empty block at the top for ~1 s (desktop) before the image appears; on phone the bottom sheet shows the same blank block above the title. Cause: `Special:FilePath` → 302 → 301 → `thumb.wikimedia.org` (three hops). The close "×" also floats over the image with no backing.
5. **Data ships `http://` image URLs.** Every image request logs a Mixed Content warning in the console (browser auto-upgrades, but it is the first thing anyone opening DevTools sees, and it adds a hop).

### Medium

6. **Detail Level control is ambiguous.** `Legendary` and `Mainstream` are both bold red, so which is selected isn't obvious; the track fill and two filled thumbs add to it. The term names don't say what they change ("Deep Cut" is jargon). The one-line description under the switch is tiny (~11 px) and low-contrast.
7. **No page furniture beyond the sidebar footer.** About + language link are tucked at the bottom of the sidebar, below a long scrolling filter list (on tablet/phone they are inside the drawer, so a first-time mobile visitor never sees them). No footer, no contact/feedback path, no visible repo link outside About.
8. **Default GitHub Pages 404.** `/anything-else` returns the stock "Page not found · GitHub Pages" page — the single most recognisable pet-project marker, and it matters more once the landing-page split adds routes.
9. **Russian label quality.** Wikidata-sourced labels are inconsistently cased (`промышленная революция`, `азбука Морзе`, `конституция США` next to Title Case neighbours); slider stops `Профи` / `Детали` are cryptic abbreviations.
10. **Small touch targets and text.** 41–42 buttons/links under 32 px on every viewport; ~370–420 text nodes under 12 px (lane labels, axis ticks, filter descriptions). Fine for a dense data tool, weak for a first impression on a phone.
11. **Accessibility (axe, serious/moderate):** `color-contrast` on the "1800" century label (desktop); `scrollable-region-focusable` ×3 on the timeline scroll container (keyboard users can't scroll it); `region` — the sr-only `h1` sits outside any landmark. The `<main>`/`<aside>` landmarks are otherwise in place and focus rings are visible.

### Low

12. **Page weight.** ~3 MB decoded across ~42 requests (main chunk 382 KB, People detail chunk 283 KB EN / 322 KB RU) — measured decoded, so transfer size is lower; worth checking compressed on a throttled connection before treating as a problem.
13. **Sample selection shows a depiction of Muhammad** (an illuminated-manuscript miniature) as the first entity a keyboard/click-through lands on, and it will surface via example links. Not a bug, but a deliberate content-policy call before launch.
14. **Instrumentation is third-party hosted** (Umami cloud script, `async`) with no privacy line in About; low risk, but trust-minded visitors look for it.

## Implications for the map

- Findings 1, 2, 6, 7 reinforce the existing decisions (landing page, in-app help, plain-language labels) and give them evidence; finding 2 adds a **phone-specific first-screen** question the tickets don't yet cover.
- Findings 3, 4, 5, 8, 11 are concrete defects with obvious shape — no decision needed beyond prioritisation in the spec.
- Finding 13 is a content decision for the example-starting-points ticket.
