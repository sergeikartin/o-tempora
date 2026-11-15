# Product polish — spec

Status: active

Current work is listed in [the tracker index](../README.md). The implemented layout is the Top Bar and Filters Panel (web ADR 0017); the prototype/layout decision is no longer blocking work.

Make otempora.info read as a polished product to a cold visitor arriving from a shared link (the references: panchronia.com for the parchment/serif craft and landing pattern, natagant.com for the hero-plus-cards landing). Presentation and UX only; `packages/web/PRODUCT.md` is the product brief and its out-of-scope list stays locked (no era bands, overlap highlighting, tours, share cards, dark mode, more languages, PWA, embeds, no onboarding pop-ups). `packages/web/DESIGN.md` holds the visual system: the "Ledger & Ink" parchment identity is refined, not replaced.

The "aha" every item serves: **see who lived at the same time as whom, and what else was happening.**

## Delivery

- Work lands directly on `main` in small commits; no feature branches. Each ticket is independently deployable except tickets 05 and 06, which go live together (the landing page is what changes `/`).
- Tickets are in `issues/`, numbered in suggested order; `Blocked by:` lines are the only hard dependencies. Pick up any unblocked ticket.
- Docs and ADRs are part of each ticket (see `CLAUDE.md`, doc upkeep), not a follow-up.
- Russian parity is part of every ticket that adds or renames a string: draft EN and RU together, the owner reviews RU before it lands.

## Settled decisions

- **Identity:** keep parchment, Fraunces, Archivo, oxblood. Fix craft and structure, not the palette.
- **Marks:** keep thin bars with the label above (the product's signature, and it carries the density). Polish type, contrast, states and clipping; do not change the mark form or row assignment.
- **Landing Page:** at `/` and `/ru/`; timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect. A headline, pitch and switchable Curiosities lead to one call-to-action opening the selected Curiosity's lead entity. Profile anchors are supported when the lead has a shipped Profile. A footer credits the data sources and links to the license and source repository. The screenshot, stats and story-card proposal was replaced by Curiosity figures.
- **Entity Links:** `?e=<slug>` carries one entity; panning, zooming, Detail Level and filters stay out of the URL. Connections push history entries; regular selection changes follow web ADR 0019. A landing handoff may also carry a Profile-item fragment.
- **Zoom model:** +/− and the Minimap on desktop; pinch zoom and the Scrubber on phones. No Thousands/Century/Decades scale presets.
- **Reference-site features not borrowed:** era bands, ruler tracks, play mode, "who ruled" rows.

## Layout decision

The later [Top Bar and Filters Panel ticket](../overlap-and-navigation/issues/02-top-bar-and-filters-panel.md) replaced tickets 09 and 10 and shipped in `a5047ca` (web ADR 0017). Search, Detail Level, Filters and Help sit above a full-width canvas. Filters open in a popover on desktop and a bottom sheet on phones; About and language switching live in Help.

The original candidates remain in ticket 09 as historical scope. No prototype choice or layout implementation remains pending there.

## Items

| # | Ticket | Notes |
|---|---|---|
| 01 | Image and data defects | **Done.** https + `Special:Redirect` image URLs, Muhammad image denylist, tinted image slot and backed close button in the detail panel |
| 02 | Branded bilingual 404 | Core delivered; landing-return links and acceptance checks remain |
| 03 | Plain-language labels | Resolved (`f27c290`) |
| 04 | Entity Links | Resolved (`70ae408`); later Selection rules supersede the original history wording |
| 05 | Route split and landing shell | Resolved (`439eb04`) |
| 06 | Landing content | **Done.** Switchable Curiosities in place of screenshot, stats and cards |
| 07 | Canvas craft | Partially delivered; visual/performance audit and owner review remain |
| 08 | Empty Lane states | Ready for implementation |
| 09 | Timeline layout decision | Superseded by resolved overlap-and-navigation ticket 02 |
| 10 | Timeline layout implementation | Superseded by resolved overlap-and-navigation ticket 02 |
| 11 | In-app Help | Resolved (`705a9b6`, `a5047ca`) |
| 12 | Accessibility and touch-target sweep | Ready; layout and Help dependencies are terminal |
| 13 | Launch check | Waiting on 12 |
| 14 | Landing gaps | Mainstream-resolution test, RU length check, owner copy review |

## Launch check

Re-run the live-site audit's method (headless Chromium against production at 1440×900, 768×1024 and 390×844 touch × EN and `/ru/`): axe with no serious or moderate violations, LCP and CLS no worse than today (0.7–1.2 s, 0), no Mixed Content warnings, no failed requests.

## Deferred

- Page weight (~3 MB decoded): re-measure compressed on a throttled network before treating it as a problem.
- Inconsistently cased Russian Wikidata-sourced labels (a data issue).
- Resolving image URLs to final thumbnail URLs in the pipeline (needs hashed thumbnail paths; risk for SVG/TIFF/small files).
- A short muted loop instead of the static landing preview.
- Everything in `PRODUCT.md`'s out-of-scope list.
