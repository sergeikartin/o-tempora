Type: task
Status: needs-info
Blocked by: 10, 11

Runs after the layout and Help, since they change most targets. Launch bar in `PRODUCT.md`: axe with no serious or moderate violations across 1440×900, 768×1024 and 390×844 touch in both locales; usable touch targets on phone; keyboard operable (`?` opens Help, Escape closes).

## Do

- Fix axe `color-contrast`, `scrollable-region-focusable` (timeline scroll container must be keyboard-scrollable) and `region` (the sr-only `h1` must sit inside a landmark) wherever they still occur.
- Raise undersized buttons and links to a usable touch size on phone (audit: 41–42 under 32 px); raise sub-12 px text where it is chrome rather than data.
- Verify focus order and visible focus through the top-level chrome, Help, About, the detail panel and the landing page.

Docs: `packages/web/docs/design-tokens.md` if any token changes.
