Type: grilling
Status: resolved

## Answer

- **Routes:** landing at `/` and `/ru/`, timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect. Old inbound links to `/` and `/ru/` land on the landing page; nothing is preserved for them.
- **URL state:** only the selected entity, as `/timeline/?e=<id>` (an **Entity Link**). No viewport range, no Detail Level, no filters. Path-style URLs were rejected: GitHub Pages has no rewrites, so they need either a `404.html` fallback (HTTP 404 breaks link previews) or ~4,600 generated files.
- **Resolving an id:** if the entity isn't in the already-loaded levels, the app loads delta files progressively (level 3, then 4) until it finds it, raising the Detail Level only as far as the entity needs. An id that never resolves opens the timeline normally with no panel.
- **History:** selecting an entity `pushState`s (Back closes the panel); closing replaces. Panning and zooming never touch the URL.
- **Language switch:** relaxed. The timeline switch carries `e` to the sibling locale; the landing switch goes landing → landing. Ids and the entity set are identical across locales.
- **SEO:** each of the four pages is its own canonical; `hreflang` pairs landing↔landing and timeline↔timeline with `x-default` → `/`; `?e=` links canonicalize to `/timeline/` (no per-entity indexing or previews); sitemap lists the 4 URLs; one shared `og-image.png` serves all four, copy corrected for the Milestones rename.
- **Docs:** two ADRs — a root ADR for the route split superseding `0003-english-served-from-domain-root.md`, and a `packages/web` ADR for entity-only URL state with progressive loading. Living docs: `docs/deployment.md` (URL structure, second HTML entry per locale), `docs/product-scope.md` (add landing page and entity links, drop the language-switcher exclusion), `CONTEXT.md` (Landing Page, Entity Link, Starting Point — added).

## Question

How do routes and shareable URL state work once the landing page exists?

- Confirm the route structure: landing at `/` and `/ru/`, timeline at `/timeline/` and `/ru/timeline/`, no auto-redirect. What happens to existing inbound links to `/`, and to `/ru/`?
- Shareable URL state: which state is encoded (viewport range, selected entity, Detail Level, occupation/region/conflicts-milestones filters?), in what shape (query string vs. hash), and does panning replace or push history entries?
- How the language switch behaves on each page given product scope's "no deep-linking the language switcher" line — still out, or relaxed now that URL state exists?
- Canonical/hreflang/sitemap/og:image implications of two pages per locale.
- Which of this is an ADR (superseding `docs/adr/0003-english-served-from-domain-root.md`) versus living-doc updates (`docs/deployment.md`, `docs/product-scope.md`).
