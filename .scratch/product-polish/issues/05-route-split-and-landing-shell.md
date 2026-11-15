Type: task
Status: resolved
Blocked by: 04

Ships together with ticket 06: the landing page is what changes `/`.

## Do

- Landing at `/` and `/ru/`; timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect. Old inbound links to `/` and `/ru/` land on the landing page; nothing is preserved.
- Each locale's landing is its own small prerendered HTML entry with no datasets and no timeline JS. The timeline bundle is prefetched on call-to-action hover, focus or touch only. The default-viewport prerender (ADR 0013) stays on the timeline routes; `vite-plugins/*` handle per-entry preload and CSS inlining and must be checked against the four entries.
- Four self-canonical pages; `hreflang` pairs landing↔landing and timeline↔timeline with `x-default` → `/`; `?e=` links canonicalise to `/timeline/`; `sitemap.xml` lists the four URLs; one shared `og-image.png`, copy corrected for the Milestones rename.
- The landing's language switch goes landing → landing; the timeline's goes timeline → timeline (carrying `e`).
- The 404 page (ticket 02) links to the new routes.

ADR: root ADR for the route split, superseding `docs/adr/0003-english-served-from-domain-root.md` (mark 0003 `status: superseded`).
Docs: `docs/deployment.md` (URL structure, entries per locale), `docs/product-scope.md` (landing), `docs/config-variables.md` if a variable changes.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `439eb04` with root ADR 0007, four entries, per-entry prerender/preload handling, intent prefetch, canonical/hreflang/sitemap and the language switches. Landing content followed in `3ff5423` and later commits. The branded 404 already links to the timeline routes; remaining landing-return links and 404 verification are tracked in [ticket 02](02-branded-404.md).
