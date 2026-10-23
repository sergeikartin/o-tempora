Type: task
Status: ready-for-agent
Blocked by: 05

Content and layout of the **Landing Page** (see `CONTEXT.md`). Pattern: Panchronia's landing (serif headline, one call-to-action, stats, editorial cards) in our parchment identity.

## Do

- Nav: logo, About, GitHub, language switch.
- Centred `h1` "Every life in context."; subhead "See who lived at the same time, and what else was happening."; primary "Explore the timeline" button.
- A framed, non-interactive screenshot of the real timeline under it: WebP in EN and RU, captured from the real app by a committed Playwright script run by hand (not in the build), at a window where no marks are cut off at the right edge, with alt text. A missing image never blocks the call-to-action. On phone the button goes full-width and the preview starts inside the first screen.
- **Stats strip:** people, conflicts, milestones, years covered, computed from the shipped data at build time. Nothing invented.
- **Story cards (Starting Points):** 4–6 hand-picked Entity Links, each with a one-line teaser, chosen so the overlap around the entity is visible on arrival. Candidates from the earlier pass: Cleopatra `60827`, Columbus `5635`, French Revolution `Q6534`, Titanic `Q25173`. Same ids on `/ru/`. A test run after each dataset regeneration asserts every id still resolves at `Mainstream` and fails the build otherwise. Claude drafts the card copy in EN and RU; the owner reviews before it lands.
- Footer: one-line about, data credits (Pantheon, Wikidata, Wikipedia, CC BY-SA), GitHub link, language switch, a short privacy line about Umami, a link to About. Footer and About read the same message keys so they cannot drift.
- No Lane, Detail Level, Fame Score or Container on the page; say "conflicts". Check RU lengths in the stats strip and cards. Responsive from 360 px.

Docs: `docs/product-scope.md`, `docs/observability.md` if Umami events change, `CONTEXT.md` if terms change.
