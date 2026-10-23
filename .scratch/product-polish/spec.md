# Product polish — spec

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
- **Landing Page:** at `/` and `/ru/`; timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect. Content: headline, subhead, one call-to-action, a framed screenshot of the real timeline, a stats strip, and 4–6 story cards. The stats are real counts computed from the shipped data at build time (people, conflicts, milestones, years covered), never invented. The story cards are the **Starting Points** (one-line teaser each, opening the timeline via an **Entity Link**). The generic "three points" move to **Help**.
- **Entity Links:** the only URL state is `?e=<id>`; panning, zooming, Detail Level and filters never touch the URL. This is the one new feature in the pass, and it exists so Starting Points and shared states have working links.
- **Zoom model:** keep +/− and the Minimap; no Thousands/Century/Decades scale presets.
- **Reference-site features not borrowed:** era bands, ruler tracks, play mode, "who ruled" rows.

## Open decision

**Timeline screen layout** (ticket 09). The sidebar floating over the canvas clips marks and the axis start; the question is what replaces it. Candidates:

- **A. Top bar + lane gutters** — logo, search, visible Detail Level, Region popover, help slot; Occupation and group chips stacked in labelled lane gutters. Always-visible filters; costs ~150 px of canvas width and is awkward on a phone. This was the earlier grilling's choice; its wireframes are in git history at `4d8a61a^:.scratch/product-polish/wireframes/first-view/`.
- **B. Command bar + Filter popover** — full-width canvas; search, Detail Level and one Filter button in the bar; Occupation and Region in one popover (bottom sheet on phone); removable "Showing only" chips once any filter is on; lanes labelled plainly in the gutter. Recommended.
- **C. Panchronia-style floating cards** — minimal brand top-left, floating cards for lanes and for Minimap + Detail Level. Closest to the reference, most layout work.

Tickets 10, 11 and 12 are blocked on this decision.

## Items

| # | Ticket | Notes |
|---|---|---|
| 01 | Image and data defects | **Done.** https + `Special:Redirect` image URLs, Muhammad image denylist, tinted image slot and backed close button in the detail panel |
| 02 | Branded bilingual 404 | |
| 03 | Plain-language labels | |
| 04 | Entity Links | |
| 05 | Route split and landing shell | ships with 06 |
| 06 | Landing content | ships with 05 |
| 07 | Canvas craft | |
| 08 | Empty Lane states | |
| 09 | Timeline layout decision | prototype, decided by the owner |
| 10 | Timeline layout implementation | blocked by 09 |
| 11 | In-app Help | blocked by 09 |
| 12 | Accessibility and touch-target sweep | last; blocked by 10, 11 |
| 13 | Launch check | blocked by 12 |

## Launch check

Re-run the live-site audit's method (headless Chromium against production at 1440×900, 768×1024 and 390×844 touch × EN and `/ru/`): axe with no serious or moderate violations, LCP and CLS no worse than today (0.7–1.2 s, 0), no Mixed Content warnings, no failed requests.

## Deferred

- Page weight (~3 MB decoded): re-measure compressed on a throttled network before treating it as a problem.
- Inconsistently cased Russian Wikidata-sourced labels (a data issue).
- Resolving image URLs to final thumbnail URLs in the pipeline (needs hashed thumbnail paths; risk for SVG/TIFF/small files).
- A short muted loop instead of the static landing preview.
- Everything in `PRODUCT.md`'s out-of-scope list.
