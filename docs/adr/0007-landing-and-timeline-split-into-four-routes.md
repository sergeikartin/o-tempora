---
status: accepted
supersedes: 0003-english-served-from-domain-root.md
---

# Landing page at the roots, timeline under `/timeline/`

The site now has two pages per locale. The **Landing Page** lives at `/` and `/ru/`; the timeline moves to `/timeline/` and `/ru/timeline/`. English is still unprefixed and every other locale still gets its own `/<locale>/` subpath, so 0003's locale layout holds. What changes is that the root is no longer the timeline.

## Context

A cold visitor arriving from a shared link landed straight on a dense timeline with no framing. The product-polish pass adds a landing page whose job is to explain the "aha" and hand the visitor into the timeline, and a timeline that opens at the root made that impossible without a client-side redirect or an in-app overlay.

## Decision

Four static HTML entries, each its own Rollup input: `index.html`, `ru/index.html` (landing, `src/landing.tsx`) and `timeline/index.html`, `ru/timeline/index.html` (timeline, `src/main.tsx`).

- **No auto-redirect, nothing preserved.** Old inbound links to `/` and `/ru/` land on the landing page. A bare `/?e=<slug>` therefore opens the landing, not the entity.
- **The landing ships no datasets and no timeline JS.** Its markup is prerendered at build time by the same plugin that prerenders the timeline; it hydrates only a small React tree. The timeline's HTML, entry chunk, stylesheet and the locale's eager Detail Level chunks are prefetched only when the visitor hovers, focuses or touches the call-to-action.
- **The default-viewport prerender (packages/web ADR 0013) stays on the timeline routes only.** The build plugins branch on entry kind: eager dataset `modulepreload` and the timeline font set apply to timeline entries; landing entries preload just the two faces they render.
- **Four self-canonical pages.** `hreflang` pairs landing with landing and timeline with timeline, `x-default` points at `/`. `?e=` links canonicalise to `/timeline/` because each timeline page's canonical is static. The sitemap lists the four URLs.
- **Language switches stay within a page kind:** landing to landing, timeline to timeline (carrying `e`).

## Considered options

- **Client-side redirect from `/` to the timeline for returning visitors.** Rejected: no reliable signal for "returning" without storage, and it hides the landing from crawlers and shared links.
- **Landing as an overlay inside the timeline app.** Rejected: ships every dataset and the whole timeline bundle to a page that needs none of it.
- **Keep the timeline at `/` and put the landing at `/welcome/`.** Rejected: shared links and the canonical URL would keep pointing at the densest, least explanatory page.
