Labels: wayfinder:map

# Pre-launch readiness

## Destination

Every pre-publish concern for this world-history timeline — the items on Sergei's punch list (mobile, region handling, years axis/eras, layout, hover indicator, data-depth tiers, monitoring, deployment) plus what a launch-readiness audit surfaces (SEO/meta, social preview, favicon, robots/sitemap, accessibility, license/README) — resolved into a recorded decision or a spec ready to hand off. Done when nothing is left un-thought-through before Sergei shares the link for a genuine public launch (posted somewhere strangers can find it, not just a private share).

## Notes

- Domain: read-only, continuously zoomable world-history timeline. React 19 + TypeScript + Vite + D3, static JSON data, no backend, no accounts. Dual fully-independent EN/RU static builds (`docs/deployment.md`). See root `CLAUDE.md` and `docs/product-scope.md` before making scope/UX calls.
- The GitHub repo itself is going public (open source) alongside the deployed site, not just the built output — so LICENSE/README are launch-blocking, not optional polish.
- This effort's destination is an *exhaustive* punch list, so completeness beats the usual "decisions only" bias: straightforward execution items with no real open decision (SEO/meta basics, robots.txt/sitemap, a11y baseline pass) are still tracked as `task` tickets rather than left off the map.
- Default skills per session: `/grilling` and `/domain-modeling`. The years-axis ticket additionally wants `/prototype`.

## Decisions so far

- Mobile-friendly layout — **already shipped**, not just spec'd: commit `0b07b26` ("Add a mobile-responsive layout: drawer sidebar, bottom-sheet detail panel, pinch-to-zoom") landed the full `.scratch/mobile-responsive-layout/spec.md`. No ticket needed on this map.

## Not yet specified

- Whether error monitoring should extend beyond error capture (performance monitoring, session replay) and how its setup ties into whichever host [Hosting & deployment choice](issues/06-hosting-deployment-choice.md) eventually picks (env/release tagging) — too fuzzy until that ticket resolves.
- Legal/attribution interplay between the code license (once chosen) and the existing data license (`packages/shared-types/LICENSE-DATA.md` — Pantheon CC BY-SA 4.0, Wikidata CC0) — unexamined; may need a revisit once [License choice & README](issues/08-license-and-readme.md) resolves.
- Canonical-URL, `sitemap.xml`, and `hreflang` specifics for [SEO, social preview & meta basics](issues/09-seo-meta-social-basics.md) need the real domain, which is why that ticket is blocked on [Hosting & deployment choice](issues/06-hosting-deployment-choice.md).

## Out of scope

(none yet — nothing has been ruled out of this effort so far)
