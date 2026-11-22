# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Curious, history-minded visitors arriving cold from a shared link (HN, Reddit, social) who decide within about ten seconds whether to stay. Their job: see who lived at the same time as whom, and what else was happening. Recruiters and portfolio viewers are a side effect, not a design driver. Phone visitors (~360–390 px, both orientations) are first-class.

## Product Purpose

O Tempora (otempora.info) is an interactive timeline of world history, roughly 800 BCE to the present. Three lanes (People, Conflicts, Milestones) share one time axis, so the overlap of lives and events is visible at a glance. Profiles give visitors a way to learn about an entity and follow Connections to related entities. Success is a cold visitor understanding the timeline within seconds and exploring without instruction.

## Positioning

People, conflicts and milestones on one shared, pannable axis, with density controlled by a fame-gated Detail Level (Legendary, Mainstream, Specialized, Deep Cut) backed by real scores (Pantheon HPI for People; blended Wikidata sitelinks and Wikimedia pageviews for Conflicts and Milestones). The site serves static datasets and loads published Profiles on demand. Visitors can browse without an account.

## Operating Context

See the [visitor flow and supported locales](../../docs/product-scope.md). The site is a static, read-only experience.

## Capabilities and Constraints

- Out of scope are era bands, share cards, dark mode, “on this day,” embeds and PWA features. [V1 boundaries](../../docs/product-scope.md)
- Public copy says “conflicts” and keeps internal terms such as Lane, Fame Score and Container out of labels. [Glossary](../../GLOSSARY.md)
- Use astronomical year numbering internally and BCE/CE labels for visitors.

## Brand Commitments

Keep the O Tempora name and the Ledger & Ink parchment identity. [Design tokens](docs/design-tokens.md)

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
