# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Curious, history-minded visitors arriving cold from a shared link (HN, Reddit, social) who decide within about ten seconds whether to stay. Their job: see who lived at the same time as whom, and what else was happening. Recruiters and portfolio viewers are a side effect, not a design driver. Phone visitors (~360–390 px, both orientations) are first-class.

## Product Purpose

O Tempora (otempora.info) is a read-only, zoomable visualization of world history, roughly 800 BCE to the present. Three lanes (People, Conflicts, Milestones) share one time axis, so the overlap of lives and events is visible at a glance. Success is a cold visitor understanding that within seconds and wandering the timeline without instruction.

## Positioning

People, conflicts and milestones on one shared, pannable axis, with density controlled by a fame-gated Detail Level (Legendary, Mainstream, Specialized, Deep Cut) backed by real scores (Pantheon HPI for People; blended Wikidata sitelinks and Wikimedia pageviews for Conflicts and Milestones). Fully static: no accounts, no editing, no live fetching.

## Operating Context

- Opens on a ~100–120-year window of the 1800s at Mainstream; pan and zoom map-style, with no "see all history" view.
- Occupation and Region filters, a Detail Level switch, Search, and a detail panel (tagline, Wikipedia description, image, link) for any mark.
- English at `/` and Russian at `/ru/`, one build, locale resolved from the URL; both locales ship the identical entity set, with per-field English fallback.

## Capabilities and Constraints

- Read-only. No backend, no database, no accounts. All data is pipeline-generated JSON in `packages/shared-types`, never hand-edited.
- Domain vocabulary is defined in `CONTEXT.md`: Lane, Mark, Detail Level, Fame Score, Viewport Range, Minimap, Container, Region, Occupation Domain.
- Out of scope: connections or "who overlapped" highlighting, curated tours, era bands, map view, share cards, more languages, dark mode, "on this day", embeds, PWA.
- Public copy avoids internal domain terms (Lane, Fame Score, Container) and says "conflicts", not "wars".
- Years are plain signed integers (astronomical numbering); BCE/CE must render correctly.

## Brand Commitments

The name is "O Tempora". The identity stays: the name and the existing "Ledger & Ink" parchment look (`docs/design-tokens.md`) are refined, not replaced. No rebrand, no re-theme.

## Evidence on Hand

- Real datasets from Pantheon 2.0, Wikidata and Wikipedia (CC BY-SA 4.0, attributed in the About panel).
- No testimonials, user numbers, press or usage metrics exist; do not fabricate any.

## Product Principles

1. The "aha" comes first: every cue serves seeing who lived together and what else was happening.
2. Explain by showing the real timeline, not about it; no onboarding pop-ups or coach marks, and Help is only ever opened by the visitor.
3. Plain language over domain jargon in everything the visitor reads.
4. Trust through restraint: accurate attribution, no fabricated claims, a working link on every shared state.
5. Static and fast: no feature that needs a backend or live data.

## Accessibility & Inclusion

Launch bar: axe with no serious or moderate violations across 1440×900, 768×1024 and 390×844 touch in both locales; usable touch-target sizes on phone; keyboard operable (`?` opens Help, Escape closes). Russian string lengths must be checked wherever copy is added.
