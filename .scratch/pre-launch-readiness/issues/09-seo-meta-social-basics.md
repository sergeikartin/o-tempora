Type: task
Status: open
Blocked by: 06

# SEO, social preview & meta basics

## Question

Launch-readiness audit found these entirely absent from `packages/web/index.html` (and both `dist/en/`, `dist/ru/` builds):

- `<meta name="description">` and a canonical `<link>` (only a bare `<title>World History Timeline</title>` exists today)
- Open Graph / Twitter Card meta tags (no social preview when the link is shared)
- A favicon (no `<link rel="icon">`, and no `packages/web/public/` directory exists at all to hold one)
- `robots.txt` / `sitemap.xml` (absent anywhere in the repo)

This is mostly execution, not decision — tracked as a `task` per the map's Notes since the destination wants an exhaustive punch list. Blocked on [Hosting & deployment choice](06-hosting-deployment-choice.md) because canonical URLs, `sitemap.xml`, and `hreflang` linking between `/en/` and `/ru/` all need the real deployed domain.

Resolve/do:
- Write per-locale `<title>`/description copy for both the `en` and `ru` builds (Vite `mode`-based config already exists per `docs/config-variables.md` — extend the same alias/mode pattern).
- Add OG/Twitter Card tags, including an `og:image` (needs an actual image asset — decide what it shows).
- Create `packages/web/public/`, add a favicon, wire the `<link rel="icon">`.
- Add `robots.txt` and `sitemap.xml` (covering both `/en/` and `/ru/`) once the domain from ticket 06 is known.
- Add `hreflang` alternate links between the two language builds.
