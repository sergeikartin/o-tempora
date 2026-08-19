Type: task
Status: resolved
Blocked by: 06

# SEO, social preview & meta basics

## Question

Launch-readiness audit found these entirely absent from `packages/web/index.html` and `packages/web/ru/index.html`:

- `<meta name="description">` and a canonical `<link>` (only a bare `<title>World History Timeline</title>` exists today)
- Open Graph / Twitter Card meta tags (no social preview when the link is shared)
- A favicon (no `<link rel="icon">`, and no `packages/web/public/` directory exists at all to hold one)
- `robots.txt` / `sitemap.xml` (absent anywhere in the repo)

This is mostly execution, not decision — tracked as a `task` per the map's Notes since the destination wants an exhaustive punch list. Blocked on [Hosting & deployment choice](06-hosting-deployment-choice.md) because canonical URLs, `sitemap.xml`, and `hreflang` linking between `/` and `/ru/` all need the real deployed domain.

Resolve/do:
- Write per-locale `<title>`/description copy for both `index.html` (English) and `ru/index.html` (Russian) — two separate static HTML entries, no build-mode branching (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`).
- Add OG/Twitter Card tags, including an `og:image` (needs an actual image asset — decide what it shows).
- Create `packages/web/public/`, add a favicon, wire the `<link rel="icon">`.
- Add `robots.txt` and `sitemap.xml` (covering both `/` and `/ru/`) once the domain from ticket 06 is known.
- Add `hreflang` alternate links between the two locales.

## Answer

[06](06-hosting-deployment-choice.md) was already resolved (`otempora.info`, GitHub Pages) so this went ahead:

- Per-locale `<title>`/`<meta name="description">` in both `index.html` (English) and `ru/index.html` (Russian) — the Russian copy matches `messages/ru.json`'s existing `aboutDescription` wording rather than a fresh translation.
- OG/Twitter Card tags on both pages (`og:title`/`description`/`url`/`locale`/`locale:alternate`, `twitter:card summary_large_image`), pointing at one shared `og-image.png` (1200×630) — brand ring mark + "O Tempora" wordmark (Fraunces) + a small dotted timeline motif in the domain-palette colors, English tagline. Shared across both locales rather than localized: it's mostly a brand mark, and `og:title`/`og:description` already carry the localized text.
- `packages/web/public/` created: `favicon.svg` (the ring mark, oxblood-on-parchment, matches `docs/design-tokens.md`'s Ledger & Ink palette), `favicon-32.png` + `apple-touch-icon.png` (180×180) rasterized from it for browsers that don't support SVG favicons, `og-image.png`. All wired via `<link rel="icon">`/`apple-touch-icon`.
- `robots.txt` (`Allow: /`, points at the sitemap) and `sitemap.xml` (both `/` and `/ru/`, each with `xhtml:link` hreflang alternates) added to `public/`, so Vite copies them to `dist/` root unchanged.
- `hreflang` alternate `<link>` tags (`en`, `ru`, `x-default`) on both pages, plus a `rel="canonical"` per page (`/` and `/ru/`).
- Verified with a full `npm run build --workspace packages/web` + local static-file server: both `dist/index.html`/`dist/ru/index.html` heads look right, `dist/{favicon.svg,favicon-32.png,apple-touch-icon.png,og-image.png,robots.txt,sitemap.xml}` all serve 200.
