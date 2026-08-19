Labels: wayfinder:map

# Pre-launch readiness

## Destination

Every pre-publish concern for this world-history timeline — the items on Sergei's punch list (mobile, region handling, years axis/eras, layout, hover indicator, data-depth tiers, monitoring, deployment) plus what a launch-readiness audit surfaces (SEO/meta, social preview, favicon, robots/sitemap, accessibility, performance/LCP, license/README) — resolved into a recorded decision or a spec ready to hand off. Done when nothing is left un-thought-through before Sergei shares the link for a genuine public launch (posted somewhere strangers can find it, not just a private share).

## Notes

- Domain: read-only, continuously zoomable world-history timeline. React 19 + TypeScript + Vite + D3, static JSON data, no backend, no accounts. Dual fully-independent EN/RU static builds (`docs/deployment.md`). See root `CLAUDE.md` and `docs/product-scope.md` before making scope/UX calls.
- The GitHub repo itself is going public (open source) alongside the deployed site, not just the built output — so LICENSE/README are launch-blocking, not optional polish.
- This effort's destination is an *exhaustive* punch list, so completeness beats the usual "decisions only" bias: straightforward execution items with no real open decision (SEO/meta basics, robots.txt/sitemap, a11y baseline pass, performance/LCP check) are still tracked as `task` tickets rather than left off the map.
- Default skills per session: `/grilling` and `/domain-modeling`. The years-axis ticket additionally wants `/prototype`.

## Decisions so far

- Mobile-friendly layout — **already shipped**, not just spec'd: commit `0b07b26` ("Add a mobile-responsive layout: drawer sidebar, bottom-sheet detail panel, pinch-to-zoom") landed the full `.scratch/mobile-responsive-layout/spec.md`. No ticket needed on this map.
- Timeline canvas redesign (`/grill-with-docs`, resolving [03](issues/03-axis-duplication.md)): "Mountain Profile" renamed to "Minimap" project-wide (reverses ADR 0004's original naming — see `CONTEXT.md`); `YearAxis` reduced from three instances to one (middle only); lane gridlines replaced by 25-year zebra striping; Minimap gains a top-edge century-tick strip. Split into implementation tickets [03](issues/03-axis-duplication.md), [11](issues/11-rename-mountain-profile-to-minimap.md), [12](issues/12-lane-zebra-striping.md), [13](issues/13-minimap-century-marks.md). [02](issues/02-years-axis-eras.md) (labeled era bands) stays open and unrelated.
- [License choice & README](issues/08-license-and-readme.md): MIT for the code (root `LICENSE`), coexisting with `LICENSE-DATA.md`'s existing data terms (disjoint subtrees, no conflict). New root `README.md` (title "O Tempora"). Scope grew mid-grill to also cover in-app attribution — CC BY-SA 4.0's attribution clause reaches the live site, not just the repo — landed as a new `widgets/about-panel` About modal (EN/RU), closing the thread left open in `alt-data-sources` issue 10.
- [Region handling investigation](issues/04-region-handling-investigation.md): the "unsatisfying" complaint was the 6-value scheme's coarseness/approximations. Resolved by overriding `alt-data-sources` issue 13's split-into-two-schemes decision — `Region`/`UnRegion` unified onto one 22-value UN M49 scheme for all three lanes, implemented same-session, plus an unrelated 52-Q-ID maintenance gap in `region-categories.ts` closed in the same pass.
- [Hosting & deployment choice](issues/06-hosting-deployment-choice.md): already shipped, tracker was just stale — GitHub Pages, custom domain `otempora.info`, `.github/workflows/deploy.yml` auto-deploys on push to `main` (commit `25085c3`). Unblocks [09](issues/09-seo-meta-social-basics.md).
- [SEO, social preview & meta basics](issues/09-seo-meta-social-basics.md): per-locale title/description, canonical + hreflang links, OG/Twitter tags, and a new `packages/web/public/` (favicon, apple-touch-icon, one shared `og-image.png` brand mark, `robots.txt`, `sitemap.xml`) landed same-session now that the domain was known.
- [Accessibility baseline pass](issues/10-accessibility-baseline-pass.md): `eslint-plugin-jsx-a11y` added (flagged nothing existing). Lighthouse a11y audit 90 → 96: fixed a missing `<main>` landmark, invalid ARIA on the Minimap track, and two modal-like overlays (mobile filter drawer, About panel) that didn't actually trap/restore focus despite reading as modal. One Lighthouse contrast flag checked and confirmed a false positive (5.75:1, passes AA) — left alone. Explicitly deferred: the ~800 D3-rendered timeline entity marks (people/conflicts/milestones) and the Minimap's scrub track are pointer/touch-only with no keyboard path at all — flagged as its own future effort (roving-tabindex/arrow-key nav design), not a baseline-pass fix. Also surfaced (and left unfixed, as a candidate for its own ticket): `npm run lint` is broken on `dev` independent of this work — root `typescript@^7.0.2` isn't yet supported by `typescript-eslint`.

## Not yet specified

- [Search bar](issues/15-search-bar.md): whether search is in scope for v1 at all (product-scope.md rules out search *outside* the current Fame Tier, implying in-tier search may be intended but it's never been spec'd), what it searches over, and how it interacts with the existing filter pills — needs a scope decision before it's implementation-ready.
- Whether error monitoring should extend beyond error capture (performance monitoring, session replay) — GlitchTip is already wired for error capture (see [07](issues/07-monitoring-sentry-integration.md)), this is only about going further.

## Out of scope

(none yet — nothing has been ruled out of this effort so far)
