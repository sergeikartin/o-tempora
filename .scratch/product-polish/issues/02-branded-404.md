Type: task
Status: ready-for-agent

Audit finding 8: `/anything-else` serves the stock "Page not found · GitHub Pages" page, the most recognisable pet-project marker.

## Do

- One `404.html` in the parchment style, bilingual (EN and RU on the same page), with links to `/` and `/ru/` and, once ticket 05 lands, to the timeline. No timeline JS, no datasets.
- Emitted by the build so GitHub Pages serves it for unknown paths; must not break the existing `/` and `/ru/` entries or the prerender plugins.
- Plain-language copy, no domain jargon ("Page not found", a one-line way back).

## Acceptance

- An unknown path on the preview build returns the branded page.
- Passes axe at 390 and 1440; RU string lengths checked.

Docs: `docs/deployment.md` (404 behaviour).
