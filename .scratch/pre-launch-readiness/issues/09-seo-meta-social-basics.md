Type: task
Status: open
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
