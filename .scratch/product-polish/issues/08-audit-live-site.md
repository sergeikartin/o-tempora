Type: task
Status: resolved

## Question

What are the concrete rough edges of the live site (https://otempora.info and `/ru/`) as a cold first-time visitor sees it? Capture at desktop (1440×900), tablet (768×1024), and phone (390×844) widths: first-paint view, an entity selected (detail panel), the About panel, the filters, and the Russian page; plus console/network errors, load metrics (LCP, CLS, transfer size), and accessibility basics. Output is a findings list in `../research/live-site-audit.md`, ranked by how strongly each reads as "pet project", that feeds the fog on the map and the spec ticket.

## Answer

Full findings, ranked, with method and gaps: `../research/live-site-audit.md`. Headlines: nothing on arrival explains the product (the OG card does, the page doesn't); the phone first screen is a bare canvas (unlabelled hamburger, no lane labels, no zoom buttons, empty bottom third); on desktop the Filters card covers and clips the left of the timeline; the detail panel shows a ~1 s blank image slot (three-hop Commons redirect) and data ships `http://` image URLs (Mixed Content warnings); default GitHub Pages 404. Performance is already good (LCP 0.7–1.2 s, CLS 0). Axe flagged a century-label contrast failure and three non-keyboard-focusable scroll regions.
