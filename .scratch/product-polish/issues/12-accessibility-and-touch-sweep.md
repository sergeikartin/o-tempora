Type: task
Status: ready-for-agent
Blocked by: 10, 11

Runs after the layout and Help, since they change most targets. Launch bar in `PRODUCT.md`: axe with no serious or moderate violations across 1440×900, 768×1024 and 390×844 touch in both locales; usable touch targets on phone; keyboard operable (`?` opens Help, Escape closes).

## Do

- Fix axe `color-contrast`, `scrollable-region-focusable` (timeline scroll container must be keyboard-scrollable) and `region` (the sr-only `h1` must sit inside a landmark) wherever they still occur.
- Raise undersized buttons and links to a usable touch size on phone (audit: 41–42 under 32 px); raise sub-12 px text where it is chrome rather than data.
- Verify focus order and visible focus through the top-level chrome, Help, About, the detail panel and the landing page.

Docs: `packages/web/docs/design-tokens.md` if any token changes.

## Comments

Tracker reconciliation (2026-11-15): Layout and Help are delivered; their dependency statuses above are terminal. `27067e3` made lane scroll regions keyboard-focusable and removed `scrollable-region-focusable` from the axe baseline. The current baseline still exempts the sr-only `h1` `region` violation. That fix plus the full touch-target/focus/contrast sweep remain; a passing baseline-aware check is not proof of the zero-violations launch bar.
